/**
 * Display helpers for money.
 *
 * The API speaks integer PAISE for every amount, so the browser never does
 * financial arithmetic - it only formats. Any figure shown here was computed
 * on the server from the ledger.
 */

/** 1234550 -> "₹12,345.50" */
export const formatPaise = (paise) => {
  const value = Math.round(Number(paise) || 0) / 100;
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** 1234550 -> "₹12,346" - for dense summary cards. */
export const formatPaiseShort = (paise) => {
  const value = Math.round(Number(paise) || 0) / 100;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

/** 1000 bps -> "10%" */
export const formatBps = (bps) => `${(Number(bps || 0) / 100).toFixed(Number(bps) % 100 === 0 ? 0 : 2)}%`;

/** Badge styling per payment/withdrawal status, in the existing palette. */
const STATUS_TONE = {
  SUCCESS: 'green', CASH_CONFIRMED: 'green', COMPLETED: 'green', REFUNDED: 'slate',
  PENDING: 'amber', INITIATED: 'amber', PROCESSING: 'amber', CASH_PENDING: 'amber',
  REQUESTED: 'amber', REFUND_REQUESTED: 'amber', REFUND_PROCESSING: 'amber',
  FAILED: 'red', CASH_DISPUTED: 'red', REFUND_FAILED: 'red',
  CANCELLED: 'slate', CASH_CANCELLED: 'slate', REVERSED: 'slate', CASH_REFUND_CONFIRMED: 'slate'
};

const TONE_CLASS = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  red: 'bg-red-50 text-brand-danger border-red-200',
  slate: 'bg-brand-bg text-brand-textSec border-brand-border'
};

export const statusClass = (status) => TONE_CLASS[STATUS_TONE[status] || 'slate'];

/** "CASH_CONFIRMED" -> "Cash confirmed" */
export const statusLabel = (status) => {
  const text = String(status || '').replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const METHOD_LABEL = { online: 'Online', cash: 'Cash' };

export default { formatPaise, formatPaiseShort, formatBps, statusClass, statusLabel, METHOD_LABEL };
