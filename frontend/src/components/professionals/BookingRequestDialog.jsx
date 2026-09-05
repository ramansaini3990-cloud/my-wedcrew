import { useState } from 'react';
import { X, Send, Loader2, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

/**
 * Confirm and send a booking request.
 *
 * The endpoint refuses in two distinct ways, decided by
 * connectionService.canSendBookingRequest:
 *
 *   DUPLICATE_BOOKING_REQUEST  a pending request for this pair already exists
 *   ALREADY_CONNECTED          already working together (accepted booking or
 *                              accepted application) - and the response carries
 *                              the conversation id, so the right next step is
 *                              "message them", not "try again"
 *
 * Both were previously swallowed by a generic `alert('Failed to send booking
 * request')`, which told the user nothing about what to do instead. Each now
 * gets its own message and, where one exists, its own action.
 */
const REQUEST_TIMEOUT_MS = 15_000;

export default function BookingRequestDialog({ professional, onClose, onSent }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [done, setDone] = useState(false);

  const name = professional?.locked
    ? `this ${professional.profession || 'professional'}`
    : professional?.name || 'this professional';

  const submit = async () => {
    setBusy(true);
    setError(null);
    setConversationId(null);
    try {
      await api.post(
        '/api/booking-requests',
        { freelancer_id: professional.id || professional._id },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      setDone(true);
      onSent?.(professional);
    } catch (err) {
      const data = err.response?.data || {};
      if (data.code === 'DUPLICATE_BOOKING_REQUEST') {
        setError('You already have a booking request pending with this professional. Wait for them to respond before sending another.');
      } else if (data.code === 'ALREADY_CONNECTED') {
        setError(data.message || 'You are already connected with this professional. Message them instead.');
        setConversationId(data.conversation_id || null);
      } else if (data.code === 'USER_NOT_FOUND') {
        setError('That professional is no longer available.');
      } else if (!err.response) {
        setError(
          err.code === 'ECONNABORTED'
            ? 'That took too long. Check your connection and try again.'
            : 'We could not reach the server. Check your connection and try again.'
        );
      } else {
        setError(data.message || 'Could not send this booking request.');
      }
    } finally {
      // Always clears, so the dialog can never be left spinning.
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Send booking request"
    >
      <div className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[16px] font-bold text-brand-navy">
            {done ? 'Request sent' : 'Send a booking request'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-brand-textSec transition-colors hover:text-brand-primary"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <>
            <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-brand-textSec">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand-success" aria-hidden="true" />
              Your request is on its way to {name}. You will be notified when they respond, and a
              conversation opens automatically if they accept.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-brand-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-brand-textSec">
              This lets {name} know you would like to work together. They can accept or decline; if
              they accept, a conversation opens between you.
            </p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="flex items-start gap-2 text-[12.5px] font-medium text-brand-danger">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
                </p>
                {conversationId && (
                  <Link
                    to="/messages"
                    state={{ activeConversationId: conversationId }}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-primary hover:underline"
                  >
                    <MessageSquare size={13} aria-hidden="true" /> Open your conversation
                  </Link>
                )}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                {busy ? 'Sending…' : 'Send request'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-brand-border px-4 py-2.5 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
