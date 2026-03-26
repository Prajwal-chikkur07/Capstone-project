import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { authLogin, authSignup, setToken } from '../services/api';

export default function AuthPage() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { token, user } = await authLogin({ email: form.email, password: form.password });
      setToken(token);
      login(user, token);
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.email.includes('@')) { setError('Enter a valid email.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      const { token, user } = await authSignup({ name: form.name, email: form.email, password: form.password });
      setToken(token);
      login(user, token);
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#faf8f4]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-[#1a0f00] px-12 py-12 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/seedlinglabs-logo.png" alt="Seedlinglabs" className="w-9 h-9 rounded-full object-cover" />
          <span className="text-white font-bold text-[16px] tracking-tight">SeedlingSpeaks</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#c9a84c] uppercase tracking-widest mb-6">What you can do</p>
          {[
            'Transcribe speech in 10 Indian languages',
            'Translate to any native language instantly',
            'Rewrite in Email, Slack, LinkedIn tones',
            'Send directly to your channels',
            'Vision translate from photos',
            'Continuous hands-free listening',
          ].map(item => (
            <div key={item} className="flex items-start gap-3 mb-4">
              <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-[#c9a84c]" />
              </div>
              <p className="text-[14px] text-white/60 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-white/20">Powered by Seedlinglabs · v2.5</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-6 py-12">
        <div className="w-full max-w-[400px]">
          <button onClick={() => navigate('/landing')}
            className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-[#8a5c2e] font-medium mb-8 transition-colors">
            ← Back to home
          </button>

          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img src="/seedlinglabs-logo.png" alt="Seedlinglabs" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-[15px] font-bold text-[#1a0f00]">SeedlingSpeaks</span>
          </div>

          <h2 className="text-[20px] md:text-[26px] font-extrabold text-[#1a0f00] mb-1">
            {tab === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-[14px] text-gray-400 mb-8">
            {tab === 'login' ? 'Sign in to continue to SeedlingSpeaks.' : 'Get started with SeedlingSpeaks for free.'}
          </p>

          <form onSubmit={tab === 'login' ? handleLogin : handleSignup} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Full name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Your name" required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-[#c9a84c] transition-all bg-white" />
              </div>
            )}
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="you@example.com" required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-[#c9a84c] transition-all bg-white" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'} required
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-[14px] focus:outline-none focus:border-[#c9a84c] transition-all bg-white" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-[13px] text-red-500 font-medium">{error}</p>}
            {signedUp && (
              <p className="text-[13px] text-green-600 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />Account created! Signing you in…
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1a0f00] hover:bg-[#2d1a00] text-white text-[14px] font-bold transition-all disabled:opacity-50 mt-2">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <>{tab === 'login' ? 'Sign in' : 'Create account'}<ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-[12px] text-gray-400 mt-6">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setTab(tab === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-[#8a5c2e] font-semibold hover:underline">
              {tab === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
