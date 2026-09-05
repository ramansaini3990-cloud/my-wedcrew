import mongoose from 'mongoose';
import EmailLog from '../../models/EmailLog.js';
import User from '../../models/User.js';
import { logFromRequest } from '../../services/activityService.js';

/**
 * Admin visibility into transactional email, plus a manual verification
 * override for the case where somebody genuinely cannot receive our mail
 * (corporate filter, typo'd-but-real domain, provider outage).
 *
 * Mounted behind the existing `protect, admin` guards in adminRoutes.js.
 */

/**
 * GET /api/admin/email-logs
 *
 * Newest first, paginated, filterable by status.
 *
 * The EmailLog model stores no token, URL or body, so there is nothing here
 * that could be used to take over an account — the DTO is metadata only.
 */
export const listEmailLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    const query = {};
    // Allow-listed, so a crafted ?status[$ne]= cannot become an operator.
    if (['SENT', 'FAILED'].includes(req.query.status)) query.status = req.query.status;
    if (['verification'].includes(req.query.template)) query.template = req.query.template;

    const [rows, total] = await Promise.all([
      EmailLog.find(query)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: String(r._id),
        to: r.to,
        subject: r.subject,
        template: r.template,
        provider: r.provider,
        status: r.status,
        error_message: r.error_message || null,
        user_id: r.user_id ? String(r.user_id) : null,
        created_at: r.created_at
      })),
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('listEmailLogs error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not load email logs.' });
  }
};

/**
 * PATCH /api/admin/users/:id/verify-email
 *
 * Manually marks an account verified. Deliberately admin-only and always
 * audited — it bypasses proof of address ownership, so it must be traceable
 * to the admin who did it.
 */
export const adminVerifyUserEmail = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    const user = await User.findById(req.params.id).select('name email role email_verified');
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found.' });

    if (user.email_verified === true) {
      return res.status(409).json({
        code: 'ALREADY_VERIFIED',
        message: 'That account is already verified.'
      });
    }

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

    await logFromRequest(req, {
      eventType: 'admin.email_verified_manually',
      category: 'users',
      severity: 'warning',
      title: 'Email verified manually by admin',
      description: `${user.name}'s email was marked verified without a confirmation link`,
      target: { type: 'user', id: user._id, label: user.name },
      // No token, and no email address — activityService blocks addresses anyway.
      metadata: { account_type: user.role, reason: String(req.body?.reason || '').slice(0, 200) || undefined }
    });

    res.json({
      success: true,
      message: 'Account marked as verified.',
      data: { id: String(user._id), email_verified: true }
    });
  } catch (error) {
    console.error('adminVerifyUserEmail error:', error);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Could not verify this account.' });
  }
};

export default { listEmailLogs, adminVerifyUserEmail };
