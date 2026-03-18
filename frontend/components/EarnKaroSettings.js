'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { earnkaroApi, ApiError } from '../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEALTH_POLL_MS = 30_000;

const LOG_EVENT_LABELS = {
  login_start:     'Login started',
  login_success:   'Login successful',
  login_fail:      'Login failed',
  manual_connect:  'Manual cookies uploaded',
  validation:      'Session validated',
  session_expired: 'Session expired',
  auto_relogin:    'Auto re-login triggered',
  refresh_start:   'Refresh started',
  refresh_success: 'Refresh successful',
  refresh_failure: 'Refresh failed',
  refresh_skipped: 'Refresh skipped',
  disconnect:      'Disconnected',
  error:           'Error',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleString();
}

function fmtHours(h) {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${Math.round(h * 10) / 10}h`;
}

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ── Connection Steps Indicator ────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Enter credentials' },
  { id: 2, label: 'Launching browser' },
  { id: 3, label: 'Logging into EarnKaro' },
  { id: 4, label: 'Saving session' },
];

function StepIndicator({ currentStep }) {
  if (!currentStep) return null;
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="text-xs font-semibold text-blue-800 mb-3">Connecting to EarnKaro...</p>
      <div className="space-y-2">
        {STEPS.map((step) => {
          const done    = currentStep > step.id;
          const active  = currentStep === step.id;
          return (
            <div key={step.id} className="flex items-center gap-2.5">
              <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-all ${
                done   ? 'bg-green-500 text-white' :
                active ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                         'bg-gray-200 text-gray-400'
              }`}>
                {done ? '✓' : step.id}
              </span>
              <span className={`text-xs transition-colors ${
                active ? 'text-blue-800 font-medium' : done ? 'text-green-700' : 'text-gray-400'
              }`}>
                {active && <Spinner className="inline h-3 w-3 mr-1" />}
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Health Badge ──────────────────────────────────────────────────────────────

function HealthBadge({ health, connected }) {
  if (!connected) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 border border-gray-200 text-gray-500">
        <span className="h-2 w-2 rounded-full bg-gray-400" /> Not Connected
      </div>
    );
  }

  const cfg = {
    healthy:  { dot: 'bg-green-500 animate-pulse', bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700', label: '🟢 Healthy' },
    expiring: { dot: 'bg-amber-400',               bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700', label: '🟡 Expiring Soon' },
    expired:  { dot: 'bg-red-500',                 bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',   label: '🔴 Expired' },
    unknown:  { dot: 'bg-gray-400',                bg: 'bg-gray-100',  border: 'border-gray-200',  text: 'text-gray-600',  label: 'Unknown' },
  }[health] || { dot: 'bg-gray-400', bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-600', label: 'Unknown' };

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text} border`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </div>
  );
}

// ── Health Panel ──────────────────────────────────────────────────────────────

function HealthPanel({ health, onRefresh, refreshing }) {
  if (!health?.connected) return null;

  const agePct   = Math.min(100, health.cookieAgePct || 0);
  const barColor = health.health === 'healthy'  ? 'bg-green-500'
                 : health.health === 'expiring' ? 'bg-amber-400'
                 : 'bg-red-500';

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Session Health</p>
        {health.hasCredentials ? (
          <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
            Auto-refresh active
          </span>
        ) : (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
            Re-login to enable auto-refresh
          </span>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
          <span>Cookie age: {fmtHours(health.cookieAgeHours)}</span>
          <span>Expires at ~{fmtHours(health.thresholds?.expiringHours)}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${agePct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
          <p className="text-gray-400">Last validated</p>
          <p className="font-medium text-gray-700 mt-0.5">{timeAgo(health.lastValidated)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
          <p className="text-gray-400">Login method</p>
          <p className="font-medium text-gray-700 mt-0.5 capitalize">{health.loginMethod || '—'}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
          <p className="text-gray-400">Cookies loaded</p>
          <p className="font-medium text-gray-700 mt-0.5">{health.cookiesCount || 0}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg px-3 py-2">
          <p className="text-gray-400">Next refresh</p>
          <p className="font-medium text-gray-700 mt-0.5">
            {health.hasCredentials && health.nextRefreshHours != null
              ? `in ~${fmtHours(health.nextRefreshHours)}`
              : 'Manual only'}
          </p>
        </div>
      </div>

      {health.hasCredentials && (
        <button onClick={onRefresh} disabled={refreshing}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors bg-white">
          {refreshing ? <><Spinner className="h-3 w-3" /> Refreshing...</> : <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Force Refresh Session
          </>}
        </button>
      )}
    </div>
  );
}

// ── Log Panel ─────────────────────────────────────────────────────────────────

function LogPanel({ logs }) {
  if (!logs?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Recent Activity</p>
        <span className="text-[10px] text-gray-400">last {logs.length} events</span>
      </div>
      <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
        {logs.map((log) => (
          <div key={log._id} className="px-4 py-2 flex items-start gap-2.5">
            <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${
              log.level === 'error' ? 'bg-red-500' : log.level === 'warn' ? 'bg-amber-400' : 'bg-green-500'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-700 font-medium">
                {LOG_EVENT_LABELS[log.event] || log.event}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{log.message}</p>
            </div>
            <span className="text-[10px] text-gray-300 shrink-0">{timeAgo(log.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Login Form ────────────────────────────────────────────────────────────────

function LoginForm({ email, setEmail, password, setPassword, showPass, setShowPass, loggingIn, onSubmit, compact = false, submitLabel = 'Connect EarnKaro' }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {!compact && (
        <p className="text-xs text-gray-500">
          Credentials are used once to capture session cookies — never stored to disk or database.
          After login, the session auto-refreshes every 12 hours using encrypted in-memory credentials.
        </p>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Email / Phone</label>
        <input type="text" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com or 9876543210" disabled={loggingIn} required
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" disabled={loggingIn} required
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
          <button type="button" onClick={() => setShowPass((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600">
            {showPass
              ? <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            }
          </button>
        </div>
      </div>

      <button type="submit" disabled={loggingIn || !email.trim() || !password.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">
        {loggingIn
          ? <><Spinner /> Connecting to EarnKaro...</>
          : <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg> {submitLabel}</>
        }
      </button>

      {loggingIn && (
        <p className="text-xs text-center text-gray-400">Launching browser — this takes 15–30 seconds...</p>
      )}
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EarnKaroSettings() {
  const [health,        setHealth]        = useState(null);
  const [logs,          setLogs]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loggingIn,     setLoggingIn]     = useState(false);
  const [relogining,    setRelogining]    = useState(false);
  const [testing,       setTesting]       = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showManual,    setShowManual]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState(null);
  const [showLogs,      setShowLogs]      = useState(false);
  const [connectStep,   setConnectStep]   = useState(null); // 1-4 during connection

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [reEmail,     setReEmail]     = useState('');
  const [rePassword,  setRePassword]  = useState('');
  const [reShowPass,  setReShowPass]  = useState(false);

  const fileRef  = useRef(null);
  const pollRef  = useRef(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchHealth = useCallback(async () => {
    try {
      const data = await earnkaroApi.health();
      setHealth(data);
      return data;
    } catch {
      setHealth((prev) => prev ?? { connected: false, health: 'unknown' });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await earnkaroApi.logs(20);
      setLogs(data.logs || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchHealth().then((h) => { if (h?.connected) fetchLogs(); });
    pollRef.current = setInterval(fetchHealth, HEALTH_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchHealth]);

  useEffect(() => { if (showLogs) fetchLogs(); }, [showLogs, fetchLogs]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoggingIn(true);
    setConnectStep(1);
    setToast(null);
    try {
      // Simulate step progression so the user sees progress
      setConnectStep(2);
      await new Promise((r) => setTimeout(r, 800));
      setConnectStep(3);
      const result = await earnkaroApi.login(email.trim(), password);
      setConnectStep(4);
      await new Promise((r) => setTimeout(r, 400));
      showToast('success', result.message || 'Connected successfully');
      setEmail(''); setPassword('');
      await fetchHealth();
      await fetchLogs();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : err.message || 'Login failed');
    } finally {
      setLoggingIn(false);
      setConnectStep(null);
    }
  };

  const handleRelogin = async (e) => {
    e.preventDefault();
    if (!reEmail.trim() || !rePassword.trim()) return;
    setRelogining(true);
    try {
      const result = await earnkaroApi.relogin(reEmail.trim(), rePassword);
      showToast('success', result.message || 'Re-connected successfully');
      setReEmail(''); setRePassword('');
      await fetchHealth();
      await fetchLogs();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : err.message || 'Re-login failed');
    } finally {
      setRelogining(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await earnkaroApi.test();
      showToast(result.connected ? 'success' : 'error', result.message);
      await fetchHealth();
      await fetchLogs();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await earnkaroApi.refresh();
      showToast('success', result.message || 'Session refreshed');
      await fetchHealth();
      await fetchLogs();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await earnkaroApi.disconnect();
      showToast('success', 'Disconnected');
      setHealth({ connected: false, health: 'unknown' });
      setLogs([]);
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const cookies = JSON.parse(await file.text());
      if (!Array.isArray(cookies)) throw new Error('File must be a JSON array');
      const result = await earnkaroApi.connect(cookies);
      showToast('success', result.message || `${result.cookiesCount} cookies saved`);
      setShowManual(false);
      await fetchHealth();
      await fetchLogs();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : err.message);
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const connected = health?.connected;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">EarnKaro Login</h2>
          <p className="text-xs text-gray-500 mt-0.5">Self-healing affiliate session · auto-refresh every 12h</p>
        </div>
        {!loading && <HealthBadge health={health?.health} connected={connected} />}
      </div>

      <div className="p-5 space-y-4">

        {loading ? (
          <div className="h-32 animate-pulse bg-gray-100 rounded-lg" />
        ) : connected ? (

          /* ── CONNECTED ──────────────────────────────────────────────── */
          <>
            {/* Session summary */}
            <div className={`flex items-start gap-4 p-4 rounded-lg border ${
              health.health === 'expired'  ? 'bg-red-50 border-red-200' :
              health.health === 'expiring' ? 'bg-amber-50 border-amber-200' :
                                            'bg-green-50 border-green-200'
            }`}>
              <div className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-full ${
                health.health === 'expired'  ? 'bg-red-100' :
                health.health === 'expiring' ? 'bg-amber-100' : 'bg-green-100'
              }`}>
                {health.health === 'healthy' ? (
                  <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                ) : health.health === 'expiring' ? (
                  <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                ) : (
                  <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  health.health === 'expired' ? 'text-red-800' : health.health === 'expiring' ? 'text-amber-800' : 'text-green-800'
                }`}>
                  {health.health === 'healthy'  ? 'Connected successfully' :
                   health.health === 'expiring' ? 'Session Expiring Soon' : 'Session Expired'}
                </p>
                <p className={`text-xs mt-0.5 ${
                  health.health === 'expired' ? 'text-red-600' : health.health === 'expiring' ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {health.cookiesCount} cookies · {fmtHours(health.cookieAgeHours)} old
                  {health.email ? ` · ${health.email}` : ''}
                </p>
              </div>
            </div>

            {/* Health panel */}
            <HealthPanel health={health} onRefresh={handleRefresh} refreshing={refreshing} />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleTest} disabled={testing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {testing ? <><Spinner className="h-3.5 w-3.5" /> Testing...</> : <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Test Session
                </>}
              </button>

              <button onClick={() => setShowLogs((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                {showLogs ? 'Hide Logs' : 'View Logs'}
              </button>

              <button onClick={handleDisconnect} disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors ml-auto">
                {disconnecting ? <><Spinner className="h-3.5 w-3.5" /> Disconnecting...</> : <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  Disconnect
                </>}
              </button>
            </div>

            {/* Logs */}
            {showLogs && <LogPanel logs={logs} />}

            {/* Re-login (collapsed) */}
            <details className="group">
              <summary className="text-xs text-blue-600 hover:underline cursor-pointer list-none flex items-center gap-1">
                <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                Re-login / Refresh credentials
              </summary>
              <div className="mt-3">
                <LoginForm
                  email={reEmail} setEmail={setReEmail}
                  password={rePassword} setPassword={setRePassword}
                  showPass={reShowPass} setShowPass={setReShowPass}
                  loggingIn={relogining} onSubmit={handleRelogin}
                  compact={true} submitLabel="Re-login &amp; Refresh"
                />
              </div>
            </details>
          </>

        ) : (

          /* ── NOT CONNECTED ───────────────────────────────────────────── */
          <>
            {/* Step indicator (shown during connection) */}
            {connectStep && <StepIndicator currentStep={connectStep} />}

            {!connectStep && (
              <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-amber-100">
                  <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800">Not Connected</p>
                  <p className="text-xs text-amber-600 mt-0.5">Login once — the system auto-refreshes every 12h automatically.</p>
                </div>
              </div>
            )}

            <LoginForm {...{ email, setEmail, password, setPassword, showPass, setShowPass, loggingIn, onSubmit: handleLogin, submitLabel: 'Connect EarnKaro' }} />

            {/* Manual fallback */}
            <div className="border-t border-gray-100 pt-3">
              <button onClick={() => setShowManual((v) => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                <svg className={`h-3 w-3 transition-transform ${showManual ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                Manual cookie upload (advanced fallback)
              </button>

              {showManual && (
                <div className="mt-3 space-y-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">Export cookies from Chrome:</p>
                    <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                      <li>Log into <strong>earnkaro.com</strong></li>
                      <li>Install <strong>Cookie-Editor</strong> extension</li>
                      <li>Click extension → <strong>Export → JSON</strong></li>
                      <li>Upload the file below</li>
                    </ol>
                  </div>
                  <label className={`cursor-pointer flex w-fit items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${saving ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}`}>
                    {saving ? <><Spinner /> Saving...</> : <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Upload Cookies JSON</>}
                    <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileUpload} disabled={saving} className="sr-only" />
                  </label>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-5 mb-5 flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success'
            ? <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
            : <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          }
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
