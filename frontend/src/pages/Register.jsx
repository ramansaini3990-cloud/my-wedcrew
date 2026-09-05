import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, Loader2, Clock } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import PasswordInput from '../components/ui/PasswordInput';
import useResendVerification from '../hooks/useResendVerification';

/**
 * Shown after a successful signup. The account exists but holds no session
 * until the emailed link is opened, so this screen explains that and offers a
 * resend rather than pretending the user is logged in.
 */
function CheckYourEmail({ email }) {
  const { resend, sending, cooldown, message, error } = useResendVerification(email);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full rounded-3xl border border-brand-border bg-white p-10 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-primary/30 bg-brand-primary/5">
          <MailCheck size={26} className="text-brand-primary" aria-hidden="true" />
        </div>

        <h2 className="font-serif text-2xl font-bold text-brand-navy">Confirm your email</h2>
        <p className="mt-3 text-sm leading-relaxed text-brand-textSec">
          We sent a verification link to
        </p>
        <p className="mt-1 break-all text-sm font-semibold text-brand-navy">{email}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-brand-textSec">
          Open it to activate your account and sign in. The link expires in 24 hours.
          If it is not in your inbox, check your spam folder.
        </p>

        {message && (
          <p className="mt-5 rounded-xl border border-brand-success/30 bg-brand-success/10 p-3 text-[13px] font-medium text-brand-success">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-5 rounded-xl border border-brand-danger/30 bg-brand-danger/10 p-3 text-[13px] font-medium text-brand-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={resend}
          disabled={sending || cooldown > 0}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {cooldown > 0 && <Clock size={15} aria-hidden="true" />}
          {sending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </button>

        <p className="mt-5 text-[13px] text-brand-textSec">
          Already confirmed?{' '}
          <Link to="/login" className="font-medium text-brand-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function Register() {
  const [role, setRole] = useState('freelancer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  // Set once registration succeeds; switches the page to the "check your email"
  // state. Registration no longer returns a token, so there is nothing to
  // redirect into.
  const [registeredEmail, setRegisteredEmail] = useState('');

  const { register } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await register({
        role,
        name,
        email,
        phone,
        password
      });

      // No token is issued until the address is confirmed.
      setRegisteredEmail(email.trim().toLowerCase());
    } catch (err) {
      // The API returns a specific code per rejection, so the message can say
      // what is actually wrong instead of a generic failure.
      const data = err.response?.data || {};
      const byCode = {
        DISPOSABLE_EMAIL:
          'Temporary or disposable email addresses are not accepted. Please use a permanent address.',
        INVALID_EMAIL: 'That email address does not look valid. Check it for a typo.',
        DOMAIN_CANNOT_RECEIVE_MAIL:
          'That email domain cannot receive mail. Check the part after the @ for a typo.'
      };
      setError(byCode[data.code] || data.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  // Registration succeeded: the account exists but cannot sign in yet, so the
  // page becomes a confirmation screen rather than redirecting to /login.
  if (registeredEmail) {
    return <CheckYourEmail email={registeredEmail} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-3xl h-full opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand-primary rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-primary rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-md w-full space-y-8 glass-card p-10 rounded-3xl relative z-10 border border-brand-border shadow-xl bg-white">
        <div>
          <div className="w-16 h-16 bg-white rounded-2xl border border-brand-primary/30 mx-auto flex items-center justify-center mb-6 shadow-sm">
            <span className="font-serif text-2xl font-bold text-brand-primary">W</span>
          </div>
          <h2 className="mt-2 text-center text-4xl font-serif font-bold text-brand-navy tracking-wide">Join mywedcrew.com</h2>
          <p className="mt-4 text-center text-sm text-brand-textSec">
            Already have an account? <Link to="/login" className="font-medium text-brand-primary hover:text-brand-primaryDark transition-colors underline-offset-4 hover:underline">Sign in</Link>
          </p>
        </div>
        
        {error && (
          <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger p-4 rounded-xl text-sm text-center font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-brand-success/10 border border-brand-success/30 text-brand-success p-4 rounded-xl text-sm text-center font-medium">
            {success}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="flex flex-col space-y-3">
             <span className="text-xs font-medium text-brand-textSec uppercase tracking-wider ml-1">I am a...</span>
             <div className="grid grid-cols-2 gap-4">
               <label className={`border rounded-xl p-4 flex items-center justify-center cursor-pointer text-sm font-bold tracking-wide transition-all ${role === 'freelancer' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary shadow-sm' : 'border-brand-border hover:border-brand-primary/50 text-brand-textSec hover:text-brand-primary bg-white'}`}>
                 <input type="radio" name="role" value="freelancer" checked={role === 'freelancer'} onChange={(e) => setRole(e.target.value)} className="hidden" /> Freelancer
               </label>
               <label className={`border rounded-xl p-4 flex items-center justify-center cursor-pointer text-sm font-bold tracking-wide transition-all ${role === 'company' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary shadow-sm' : 'border-brand-border hover:border-brand-primary/50 text-brand-textSec hover:text-brand-primary bg-white'}`}>
                 <input type="radio" name="role" value="company" checked={role === 'company'} onChange={(e) => setRole(e.target.value)} className="hidden" /> Studio
               </label>
             </div>
          </div>
          <div className="space-y-4">
            <div>
              <input id="name" name="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-white border border-brand-border placeholder-brand-muted text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary sm:text-sm transition-colors" placeholder="Full Name" />
            </div>
            <div>
              <input id="email-address" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-white border border-brand-border placeholder-brand-muted text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary sm:text-sm transition-colors" placeholder="Email address" />
            </div>
            <div>
              <input id="phone" name="phone" type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-white border border-brand-border placeholder-brand-muted text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary sm:text-sm transition-colors" placeholder="Phone Number" />
            </div>
            <div>
              <PasswordInput
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                showRequirements
                className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-white border border-brand-border placeholder-brand-muted text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary sm:text-sm transition-colors"
                placeholder="Create Password"
              />
            </div>
          </div>
          <div className="pt-2">
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full btn-primary py-3 text-base flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating Account...
                </>
              ) : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
