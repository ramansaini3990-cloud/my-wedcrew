import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Register() {
  const [role, setRole] = useState('freelancer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register');
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
          <h2 className="mt-2 text-center text-4xl font-serif font-bold text-brand-text tracking-wide">Join WedCrew</h2>
          <p className="mt-4 text-center text-sm text-brand-textSec">
            Already have an account? <Link to="/login" className="font-medium text-brand-gold hover:text-brand-text transition-colors underline-offset-4 hover:underline">Sign in</Link>
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
               <label className={`border rounded-xl p-4 flex items-center justify-center cursor-pointer text-sm font-bold tracking-wide transition-all ${role === 'freelancer' ? 'border-brand-gold bg-brand-gold/10 text-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.15)]' : 'border-gray-200 hover:border-gray-300 text-brand-textSec hover:text-brand-text bg-brand-surface/50'}`}>
                 <input type="radio" name="role" value="freelancer" checked={role === 'freelancer'} onChange={(e) => setRole(e.target.value)} className="hidden" /> Freelancer
               </label>
               <label className={`border rounded-xl p-4 flex items-center justify-center cursor-pointer text-sm font-bold tracking-wide transition-all ${role === 'company' ? 'border-brand-gold bg-brand-gold/10 text-brand-gold shadow-[0_0_15px_rgba(212,175,55,0.15)]' : 'border-gray-200 hover:border-gray-300 text-brand-textSec hover:text-brand-text bg-brand-surface/50'}`}>
                 <input type="radio" name="role" value="company" checked={role === 'company'} onChange={(e) => setRole(e.target.value)} className="hidden" /> Studio
               </label>
             </div>
          </div>
          <div className="space-y-4">
            <div>
              <input id="name" name="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-brand-surface border border-gray-200 placeholder-gray-600 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold sm:text-sm transition-colors" placeholder="Full Name" />
            </div>
            <div>
              <input id="email-address" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-brand-surface border border-gray-200 placeholder-gray-600 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold sm:text-sm transition-colors" placeholder="Email address" />
            </div>
            <div>
              <input id="phone" name="phone" type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-brand-surface border border-gray-200 placeholder-gray-600 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold sm:text-sm transition-colors" placeholder="Phone Number" />
            </div>
            <div>
              <input id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 bg-brand-surface border border-gray-200 placeholder-gray-600 text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold sm:text-sm transition-colors" placeholder="Create Password" />
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
