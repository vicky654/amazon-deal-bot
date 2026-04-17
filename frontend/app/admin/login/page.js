'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../../lib/api';
import { setToken, getToken } from '../../../lib/auth';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [email,    setEmail]    = useState('admin@dealbot.com');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Already logged in → go to dashboard
  useEffect(() => {
    if (getToken()) router.replace('/admin');
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), password);
      setToken(res.token);
      router.replace('/admin');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      {/* Subtle radial glow behind card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 600px 400px at 50% 40%, rgba(249,115,22,0.07) 0%, transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm animate-fade-in-up">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
            style={{
              background: 'linear-gradient(135deg,#f97316,#ea580c)',
              boxShadow: '0 8px 32px rgba(249,115,22,0.40)',
            }}
          >
            🔥
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DealBot Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to access your dashboard</p>
        </div>

        {/* Form card */}
        <div
          className="rounded-3xl p-6 space-y-4"
          style={{ background: 'rgba(15,23,42,0.90)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {error && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171' }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@dealbot.com"
                className="w-full px-4 py-3 rounded-2xl text-white placeholder-slate-600 text-sm focus:outline-none transition"
                style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-2xl text-white placeholder-slate-600 text-sm focus:outline-none transition"
                  style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition touch-manipulation"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-white text-sm font-bold transition-all active:scale-[0.98] touch-manipulation"
              style={loading
                ? { background: 'rgba(71,85,105,0.5)', cursor: 'not-allowed' }
                : { background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 4px 20px rgba(249,115,22,0.40)' }
              }
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign in</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">DealBot Admin · Secure access only</p>
      </div>
    </div>
  );
}
