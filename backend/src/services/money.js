/**
 * Money handling for the payment system.
 *
 * EVERY monetary amount in the payment models is stored as an INTEGER number
 * of paise (1 rupee = 100 paise). Nothing financial is ever held as a float:
 * `0.1 + 0.2 !== 0.3` in IEEE-754, and a fee split computed in rupees drifts
 * by fractions that accumulate across a ledger.
 *
 * Rupee values only ever exist at the edges - parsing user input, and
 * formatting for display.
 */

/** Largest amount we accept in one payment: ₹50,00,000. Sanity bound. */
export const MAX_AMOUNT_PAISE = 5_000_000_00;
export const MIN_AMOUNT_PAISE = 100; // ₹1

/**
 * Parses a user-supplied rupee amount into integer paise.
 *
 * Accepts "12000", "12000.50", 12000, " ₹12,000.50 ". Rejects anything that is
 * not a finite non-negative number with at most two decimal places.
 *
 * @returns {{ok: true, paise: number} | {ok: false, message: string}}
 */
export const rupeesToPaise = (input) => {
  if (input === null || input === undefined || input === '') {
    return { ok: false, message: 'Enter an amount.' };
  }

  const cleaned = String(input).replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, message: 'Enter a valid amount (up to two decimal places).' };
  }

  const [whole, frac = ''] = cleaned.split('.');
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));

  if (!Number.isSafeInteger(paise)) return { ok: false, message: 'That amount is too large.' };
  if (paise < MIN_AMOUNT_PAISE) return { ok: false, message: 'Amount must be at least ₹1.' };
  if (paise > MAX_AMOUNT_PAISE) return { ok: false, message: 'Amount exceeds the per-payment limit.' };

  return { ok: true, paise };
};

/** Integer paise -> a plain rupee number, for display only. */
export const paiseToRupees = (paise) => Math.round(Number(paise) || 0) / 100;

/** Integer paise -> "₹12,000.50", for display and notification copy. */
export const formatPaise = (paise) =>
  `₹${paiseToRupees(paise).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Applies a percentage fee to an amount, in integer paise.
 *
 * The percentage is itself handled in basis points (1% = 100 bps) so a config
 * value like 2.5% cannot introduce a float. Rounding is half-up on the fee,
 * and the freelancer's net is then computed by SUBTRACTION - never rounded
 * independently - so `fee + net === gross` always holds exactly.
 *
 * @param {number} grossPaise
 * @param {object} config  { fee_bps, min_fee_paise, max_fee_paise }
 * @returns {{gross: number, fee: number, net: number}}
 */
export const splitFee = (grossPaise, config = {}) => {
  const gross = Math.round(Number(grossPaise) || 0);
  if (gross <= 0) return { gross: 0, fee: 0, net: 0 };

  const bps = Math.max(0, Math.min(Number(config.fee_bps ?? 0), 10_000)); // cap at 100%
  // Half-up rounding on a positive integer division.
  let fee = Math.floor((gross * bps + 5000) / 10_000);

  const min = Number(config.min_fee_paise ?? 0);
  const max = config.max_fee_paise === null || config.max_fee_paise === undefined
    ? null
    : Number(config.max_fee_paise);

  if (min > 0) fee = Math.max(fee, min);
  if (max !== null && max >= 0) fee = Math.min(fee, max);

  // The fee can never exceed the amount being split.
  fee = Math.max(0, Math.min(fee, gross));

  return { gross, fee, net: gross - fee };
};

export default { rupeesToPaise, paiseToRupees, formatPaise, splitFee, MAX_AMOUNT_PAISE, MIN_AMOUNT_PAISE };
