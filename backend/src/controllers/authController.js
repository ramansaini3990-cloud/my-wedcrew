import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logActivity } from '../services/activityService.js';
import { validatePassword, passwordPolicyError } from '../services/passwordPolicy.js';
import { validateEmailAddress, normaliseEmail } from '../services/emailValidationService.js';
import { sendVerificationEmail, appPublicUrl } from '../services/emailService.js';

/* ------------------------------------------------------------------ */
/* Email verification helpers                                          */
/* ------------------------------------------------------------------ */

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

/**
 * Is verification enforced at login?
 *
 * SAFETY GUARD: production always enforces it, whatever the env says. The flag
 * exists so local development and the E2E suites can run without a mailbox —
 * it must never become a way to ship an unverified-signup production site.
 */
export const verificationRequired = () => {
  const configured = String(process.env.EMAIL_VERIFICATION_REQUIRED ?? 'true').toLowerCase() !== 'false';

  if (process.env.NODE_ENV === 'production' && !configured) {
    console.warn(
      '[auth] EMAIL_VERIFICATION_REQUIRED=false is IGNORED in production — ' +
        'email verification stays enforced.'
    );
    return true;
  }
  return configured;
};

/** Only the hash is ever stored; the raw token lives in the emailed link. */
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Issues a fresh token, persists its hash + expiry, and emails the link.
 * Never throws — a mail failure leaves the account created and resendable.
 */
const issueVerification = async (user) => {
  const token = crypto.randomBytes(32).toString('hex');

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        email_verification_token_hash: hashToken(token),
        email_verification_expires: new Date(Date.now() + VERIFICATION_TTL_MS),
        email_verification_sent_at: new Date()
      }
    }
  );

  const verifyUrl = `${appPublicUrl()}/verify-email?token=${token}`;
  return sendVerificationEmail({ to: user.email, name: user.name, verifyUrl, userId: user._id });
};

// Generate JWT Token
// Expiry was already bounded at 7d; it is now configurable via JWT_EXPIRES_IN
// so it can be shortened in production without a code change. The default is
// unchanged, so existing behaviour is identical when the var is unset.
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { role, name, phone, email, password, city, state, profession } = req.body;

    // Validate required fields
    if (!role || !name || !phone || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Strong-password policy. Enforced here, on the server, so removing the
    // client-side checks cannot create a weak account. Applies to NEW passwords
    // only - existing accounts are untouched and can still sign in.
    const policy = validatePassword(password);
    if (!policy.ok) {
      return res.status(400).json(passwordPolicyError(policy));
    }

    // Real-address validation: format, disposable blocklist, then MX records.
    // Returns a SPECIFIC code so the signup form can say what is actually
    // wrong rather than "registration failed".
    const emailCheck = await validateEmailAddress(email);
    if (!emailCheck.ok) {
      return res.status(400).json({ code: emailCheck.code, message: emailCheck.message });
    }
    const normalisedEmail = emailCheck.email;

    // Check if user exists (email or phone)
    const existingUser = await User.findOne({ $or: [{ email: normalisedEmail }, { phone }] });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or phone already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const user = await User.create({
      role,
      name,
      phone,
      email: normalisedEmail,
      password: hashedPassword,
      city: city || null,
      state: state || null,
      profession: profession || null,
      email_verified: false
    });

    // Mail failure must not roll back the account — the user can resend.
    await issueVerification(user);

    // Audit trail. logActivity never throws, so registration cannot fail here.
    await logActivity({
      eventType: `user.registered.${user.role}`,
      category: 'users',
      severity: 'success',
      title: 'New user registered',
      description: `${user.name} joined as a ${user.role}`,
      actor: { userId: user._id, name: user.name, role: user.role },
      target: { type: 'user', id: user._id, label: user.name },
      metadata: { account_type: user.role, city: user.city || undefined, state: user.state || undefined }
    });

    // Deliberately NO token: the account cannot be used until the address is
    // confirmed. The response says where the link went so the UI can show it.
    res.status(201).json({
      message: 'User registered successfully',
      userId: user.id,
      email: user.email,
      email_verified: false,
      verification_required: verificationRequired()
    });
  } catch (error) {
    // The $or check above catches almost every duplicate, but it is a
    // read-then-write: two signups racing the same phone or email can both
    // pass it and only collide at the unique index. Now that `phone` is
    // unique too, that collision must read as the SAME clean message the
    // pre-check gives, not as a 500.
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
      console.warn(`Registration rejected by unique index on "${field || 'unknown'}"`);
      return res.status(400).json({ message: 'User with this email or phone already exists' });
    }

    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Normalised to match how registration stores it. Without this, an address
    // signed up with any uppercase letter could never log in, because the
    // stored value is lowercased and this lookup would miss it.
    const user = await User.findOne({ email: normaliseEmail(email) });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Checked only AFTER the password, so this endpoint never reveals whether
    // an address is registered to someone who does not know the password.
    if (verificationRequired() && user.email_verified !== true) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirm your email address to sign in. Check your inbox for the verification link.',
        email: user.email
      });
    }

    await logActivity({
      eventType: user.role === 'admin' ? 'admin.login' : 'user.login',
      category: user.role === 'admin' ? 'admin' : 'users',
      title: user.role === 'admin' ? 'Admin signed in' : 'User signed in',
      description: `${user.name} signed in`,
      actor: { userId: user._id, name: user.name, role: user.role },
      target: { type: 'user', id: user._id, label: user.name },
      metadata: { account_type: user.role }
    });

    // Generate token and return user details
    res.json({
      token: generateToken(user),
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    // The user object is attached to the request by the auth middleware
    // email_verified is included so the verification landing page can tell an
    // ALREADY-USED link apart from an unknown one. The verify endpoint cannot:
    // it clears the token hash on success, so a replayed link and a bogus link
    // look identical to it. This reveals only the caller's own state, to
    // themselves, behind auth - it is not an account-existence oracle.
    const user = await User.findById(req.user.id).select('id role name phone email city state created_at email_verified');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error retrieving user data' });
  }
};


/* ------------------------------------------------------------------ */
/* Email verification endpoints                                        */
/* ------------------------------------------------------------------ */

// @desc    Confirm an email address and sign the user in
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ code: 'MISSING_TOKEN', message: 'Verification token is missing.' });
    }

    const tokenHash = hashToken(token);

    // Look the token up WITHOUT the expiry filter first, so an expired link can
    // be reported as expired rather than as invalid — the user needs to know
    // to request a new one rather than think they used the wrong link.
    const user = await User.findOne({ email_verification_token_hash: tokenHash })
      .select('+email_verification_token_hash');

    if (!user) {
      return res.status(400).json({
        code: 'INVALID_TOKEN',
        message: 'This verification link is not valid. Request a new one.'
      });
    }

    if (user.email_verification_expires && user.email_verification_expires.getTime() < Date.now()) {
      return res.status(400).json({
        code: 'TOKEN_EXPIRED',
        message: 'This verification link has expired. Request a new one.',
        email: user.email
      });
    }

    // Single-use: the token fields are cleared as the account is verified.
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          email_verified: true,
          email_verification_token_hash: null,
          email_verification_expires: null
        }
      }
    );

    await logActivity({
      eventType: 'user.email_verified',
      category: 'users',
      severity: 'success',
      title: 'Email address verified',
      description: `${user.name} confirmed their email address`,
      actor: { userId: user._id, name: user.name, role: user.role },
      target: { type: 'user', id: user._id, label: user.name },
      metadata: { account_type: user.role }
    });

    // Verified users are signed straight in - they have just proven they
    // control the address, so a second login step adds friction, not security.
    res.json({
      message: 'Email verified successfully',
      token: generateToken(user),
      user: { id: user.id, role: user.role, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('verifyEmail error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not verify this email address.' });
  }
};

// @desc    Send a fresh verification link
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req, res) => {
  // ONE response for every outcome. Whether the address is unknown, already
  // verified, or throttled, the caller is told the same thing - otherwise this
  // endpoint becomes a way to enumerate which addresses hold an account.
  const genericResponse = {
    message: 'If that address has an unverified account, a new verification link is on its way.'
  };

  try {
    const email = normaliseEmail(req.body?.email);
    if (!email) return res.json(genericResponse);

    const user = await User.findOne({ email });

    // Unknown address, or nothing to do - answer identically.
    if (!user || user.email_verified === true) return res.json(genericResponse);

    // Throttle: one send per 60s, measured from the last send.
    const lastSent = user.email_verification_sent_at?.getTime() || 0;
    const waited = Date.now() - lastSent;
    if (waited < RESEND_COOLDOWN_MS) {
      return res.status(429).json({
        code: 'RESEND_THROTTLED',
        message: 'A verification email was just sent. Please wait a minute before requesting another.',
        retry_after_seconds: Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000)
      });
    }

    // Rotate the token on every resend so an older link cannot be reused.
    await issueVerification(user);

    await logActivity({
      eventType: 'user.verification_resent',
      category: 'users',
      title: 'Verification email resent',
      description: `A new verification link was sent to ${user.name}`,
      actor: { userId: user._id, name: user.name, role: user.role },
      target: { type: 'user', id: user._id, label: user.name },
      metadata: { account_type: user.role }
    });

    res.json(genericResponse);
  } catch (error) {
    console.error('resendVerification error:', error);
    // Even an internal failure answers generically.
    res.json(genericResponse);
  }
};
