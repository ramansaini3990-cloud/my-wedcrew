/**
 * Frontend feature gates.
 *
 * These switch UI on and off ONLY. No backend behaviour changes with them --
 * the payment state machine, the ledger, the webhook handler and the provider
 * adapters all stay live and ready, so enabling a gate is a UI flip plus the
 * relevant server credentials, never a code change.
 */

/**
 * Can companies start an ONLINE (card / UPI / netbanking) payment?
 *
 * Currently FALSE because the Razorpay account is not connected yet. Without
 * live keys the checkout cannot complete: a payment created online would sit
 * at PENDING for ever waiting on a webhook that nothing will send, so exposing
 * the option would only strand real money-shaped records in the ledger.
 *
 * CASH PAYMENTS ARE UNAFFECTED and work end to end today.
 *
 * ---------------------------------------------------------------------------
 * TO TURN ONLINE PAYMENTS ON when the Razorpay keys arrive:
 *
 *   1. Set this constant to `true`.
 *   2. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET and
 *      PAYMENT_PROVIDER=razorpay in backend/.env, then restart the API.
 *
 * That is the whole change. Nothing else in the codebase needs touching.
 * ---------------------------------------------------------------------------
 */
export const ONLINE_PAYMENTS_ENABLED = false;

/**
 * Are freelancer withdrawals paid out automatically?
 *
 * FALSE while payouts are settled by hand: a withdrawal request is accepted
 * and sits in PROCESSING until an admin transfers the money and marks it paid.
 * The Earnings tab uses this to say so plainly rather than implying an
 * automatic transfer is on its way.
 *
 * Flip to `true` once a payout provider (RazorpayX or similar) is wired up.
 */
export const AUTOMATIC_PAYOUTS_ENABLED = false;
