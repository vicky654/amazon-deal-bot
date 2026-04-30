'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Activity, Play, Square, RefreshCw, Cpu, HardDrive, Globe, Box, Hash, Clock, ShieldCheck, AlertCircle, Trash2 } from 'lucide-react';
import api from '../../../lib/api';

export default function CrawlerControlPage() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  
  const logsEndRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/admin/crawler/status');
      if (res.data?.success) {
        setStatus(res.data.data);
      }
    } catch (err) {
      console.error('Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/crawler/logs');
      if (res.data?.success) {
        setLogs(res.data.data.logs);
      }
    } catch (err) {
      console.error('Logs fetch error:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 10000); // 10s auto refresh
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto-scroll logs
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      const res = await api.post(`/admin/crawler/${action}`);
      if (res.data?.success) {
        showToast(res.data.message || `Crawler ${action} successful`);
        fetchStatus();
        fetchLogs();
      }
    } catch (err) {
      showToast(err.response?.data?.error || `Failed to ${action} crawler`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;
    if (status.isRestarting) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Restarting
        </div>
      );
    }
    if (status.isStarting) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Starting
        </div>
      );
    }
    if (status.isStopping) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Stopping
        </div>
      );
    }
    if (status.running) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Running
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        Stopped
      </div>
    );
  };

  const isActionDisabled = (action) => {
    if (!status || status.isStarting || status.isStopping || status.isRestarting || actionLoading) return true;
    if (action === 'start' && status.running) return true;
    if (action === 'stop' && !status.running) return true;
    return false;
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin text-slate-500"><RefreshCw className="w-8 h-8" /></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl border backdrop-blur-sm flex items-center gap-3 animate-fade-in ${
          toast.type === 'error' 
            ? 'bg-danger/10 border-danger/30 text-danger' 
            : 'bg-success/10 border-success/30 text-success'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/80 border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Activity className="text-primary w-7 h-7" />
            Crawler Engine
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Remote control and monitoring for the production crawler</p>
        </div>
        
        <div className="flex items-center gap-4">
          {getStatusBadge()}
          
          <div className="flex items-center gap-2 bg-background rounded-xl p-1 border border-border">
            <button
              onClick={() => handleAction('start')}
              disabled={isActionDisabled('start')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActionDisabled('start') 
                  ? 'opacity-50 cursor-not-allowed text-muted-foreground' 
                  : 'bg-success/10 text-success hover:bg-success/20'
              }`}
            >
              {actionLoading === 'start' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start
            </button>
            <button
              onClick={() => handleAction('stop')}
              disabled={isActionDisabled('stop')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActionDisabled('stop') 
                  ? 'opacity-50 cursor-not-allowed text-muted-foreground' 
                  : 'bg-danger/10 text-danger hover:bg-danger/20'
              }`}
            >
              {actionLoading === 'stop' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              Stop
            </button>
            <button
              onClick={() => handleAction('restart')}
              disabled={isActionDisabled('restart') || !status?.running}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActionDisabled('restart') || !status?.running
                  ? 'opacity-50 cursor-not-allowed text-muted-foreground' 
                  : 'bg-warning/10 text-warning hover:bg-warning/20'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === 'restart' ? 'animate-spin' : ''}`} />
              Restart
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Box className="text-purple-400" />} label="Current Category" value={status?.currentCategory || 'Idle'} />
        <StatCard icon={<Hash className="text-blue-400" />} label="Processing ASIN" value={status?.currentAsin || '--'} />
        <StatCard icon={<ShieldCheck className="text-emerald-400" />} label="Deals Sent Today" value={status?.dealsSent || 0} />
        <StatCard icon={<Globe className="text-indigo-400" />} label="Browser Status" value={status?.browserConnected ? 'Connected' : 'Disconnected'} />
        <StatCard icon={<Clock className="text-orange-400" />} label="Last Scrape" value={status?.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'} />
        <StatCard icon={<Activity className="text-cyan-400" />} label="Queue Size" value={status?.queueSize || 0} />
        <StatCard icon={<Cpu className="text-rose-400" />} label="Active Pages" value={status?.activePages || 0} />
        <StatCard icon={<HardDrive className="text-yellow-400" />} label="Memory Usage" value={`${status?.memoryUsageMB || 0} MB`} />
      </div>

      {/* Live Logs Viewer */}
      <div className="bg-background border border-border rounded-2xl overflow-hidden flex flex-col h-[500px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Activity className="w-4 h-4 text-primary" />
            Live Logs Stream
            <span className="text-[10px] text-muted-foreground ml-2 bg-accent px-2 py-0.5 rounded-full">Auto-refresh</span>
          </div>
          <button 
            onClick={clearLogs}
            className="text-muted-foreground hover:text-danger transition-colors p-1"
            title="Clear Logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[13px] scrollbar-thin scrollbar-thumb-border">
          {logs.length === 0 ? (
            <div className="text-muted-foreground italic">No logs available...</div>
          ) : (
            // Reverse so newest logs are at the bottom for auto-scroll
            [...logs].reverse().map((log, idx) => {
              const level = log.level || 'info';
              const levelColors = {
                info: 'text-foreground/90',
                warn: 'text-warning font-medium',
                error: 'text-danger font-bold'
              };

              return (
                <div key={idx} className={`flex gap-3 hover:bg-accent px-2 py-1 rounded ${levelColors[level]}`}>
                  <span className="text-muted-foreground shrink-0 select-none">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="break-all whitespace-pre-wrap">{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-surface/80 border border-border rounded-xl p-4 flex items-start gap-4">
      <div className="p-2.5 bg-accent rounded-lg shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-lg font-semibold text-foreground truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}
