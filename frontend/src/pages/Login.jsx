import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck, Loader2, Clock } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import PasswordInput from '../components/ui/PasswordInput';
import useResendVerification from '../hooks/useResendVerification';

/**
 * Inline prompt for a correct password on an unconfirmed account.
 *
 * The credentials were right, so this is a recoverable step rather than a
 * failure: it explains what happened and offers a resend on the same 60-second
 * throttle the server enforces.
 */
function UnverifiedPrompt({ email }) {
  const { resend, sending, cooldown, message, error } = useResendVerification(email);

  return (
    <div className="rounded-xl border border-brand-warning/40 bg-brand-warning/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-brand-navy">
        <MailCheck size={16} className="text-brand-primary" aria-hidden="true" />
        Confirm your email to sign in
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-brand-textSec">
        Your password is correct, but <span className="font-medium text-brand-navy">{email}</span> has
        not been confirmed yet. Open the link we emailed you, or send a new one.
      </p>

      {message && <p className="mt-2.5 text-[12.5px] font-medium text-brand-success">{message}</p>}
      {error && <p className="mt-2.5 text-[12.5px] font-medium text-brand-danger">{error}</p>}

      <button
        type="button"
        onClick={resend}
        disabled={sending || cooldown > 0}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-white px-3 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {cooldown > 0 && <Clock size={14} aria-hidden="true" />}
        {sending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
      </button>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Set when the server answers 403 EMAIL_NOT_VERIFIED. An unverified account
  // is a recoverable state, not a credentials failure, so it gets an inline
  // resend prompt instead of a red error.
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      
      if (user.role === 'freelancer') {
        navigate('/freelancer/dashboard');
      } else if (user.role === 'company') {
        navigate('/company/dashboard');
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard');
      }
    } catch (err) {
      const data = err.response?.data || {};
      if (data.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(data.email || email.trim().toLowerCase());
        setError('');
      } else {
        setUnverifiedEmail('');
        const network = !err.response
          ? err.code === 'ECONNABORTED'
            ? 'That took too long. Check your connection and try again.'
            : 'We could not reach the server. Check your connection and try again.'
          : null;
        setError(network || data.message || 'Failed to login');
      }
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="mt-2 text-center text-4xl font-serif font-bold text-brand-navy tracking-wide">Welcome Back</h2>
          <p className="mt-4 text-center text-sm text-brand-textSec">
            Or <Link to="/register" className="font-medium text-brand-primary hover:text-brand-primaryDark transition-colors underline-offset-4 hover:underline">request studio access</Link>
          </p>
        </div>
        
        {error && (
          <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger p-4 rounded-xl text-sm text-center font-medium">
            {error}
          </div>
        )}

        {unverifiedEmail && <UnverifiedPrompt email={unverifiedEmail} />}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="text-xs font-medium text-brand-textSec uppercase tracking-wider mb-1 block ml-1">Email address</label>
              <input 
                id="email-address" 
                name="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-white border border-brand-border placeholder-brand-muted text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary sm:text-sm transition-colors" 
                placeholder="studio@example.com" 
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-medium text-brand-textSec uppercase tracking-wider mb-1 block ml-1">Password</label>
              <PasswordInput
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-white border border-brand-border placeholder-brand-muted text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/25 focus:border-brand-primary sm:text-sm transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input 
                id="remember-me" 
                name="remember-me" 
                type="checkbox" 
                className="h-4 w-4 bg-white border-brand-border rounded text-brand-primary focus:ring-brand-primary cursor-pointer" 
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-brand-textSec cursor-pointer">Remember me</label>
            </div>
            <div className="text-sm">
              <a href="#" className="font-medium text-brand-primary hover:text-brand-primaryDark transition-colors">Forgot password?</a>
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
                  Authenticating...
                </>
              ) : 'Sign In to Portal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
