import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full max-w-3xl h-full opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand-gold rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-surface rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-md w-full space-y-8 glass-card p-10 rounded-3xl relative z-10 border border-gray-200 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div>
          <div className="w-16 h-16 bg-brand-surface rounded-2xl border border-brand-gold/30 mx-auto flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            <span className="font-serif text-2xl font-bold text-brand-gold">W</span>
          </div>
          <h2 className="mt-2 text-center text-4xl font-serif font-bold text-brand-text tracking-wide">Welcome Back</h2>
          <p className="mt-4 text-center text-sm text-brand-textSec">
            Or <Link to="/register" className="font-medium text-brand-gold hover:text-brand-text transition-colors underline-offset-4 hover:underline">request studio access</Link>
          </p>
        </div>
        
        {error && (
          <div className="bg-brand-danger/10 border border-brand-danger/30 text-brand-danger p-4 rounded-xl text-sm text-center font-medium">
            {error}
          </div>
        )}

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
                className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-brand-surface border border-gray-200 placeholder-gray-600 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold sm:text-sm transition-colors" 
                placeholder="studio@example.com" 
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-medium text-brand-textSec uppercase tracking-wider mb-1 block ml-1">Password</label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-brand-surface border border-gray-200 placeholder-gray-600 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold sm:text-sm transition-colors" 
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
                className="h-4 w-4 bg-brand-surface border-gray-300 rounded text-brand-gold focus:ring-brand-gold focus:ring-offset-brand-bg cursor-pointer" 
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-brand-textSec cursor-pointer">Remember me</label>
            </div>
            <div className="text-sm">
              <a href="#" className="font-medium text-brand-gold hover:text-brand-text transition-colors">Forgot password?</a>
            </div>
          </div>
          <div className="pt-2">
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full btn-gold py-3 text-base flex justify-center items-center gap-2"
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
