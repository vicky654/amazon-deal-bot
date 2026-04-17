'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { crawlerApi, systemApi } from '../lib/api';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://deal-system-backend.onrender.com').replace(/\/$/, '');

const CrawlerContext = createContext(null);

export function CrawlerProvider({ children }) {
  const [crawlerStatus, setCrawlerStatus] = useState('stopped'); // 'running' | 'stopped' | 'stopping'
  const [progress,      setProgress]      = useState(null);
  const [activity,      setActivity]      = useState([]);
  const [autoMode,      setAutoMode]      = useState(false);
  const [autoLoading,   setAutoLoading]   = useState(true);
  const [crawlerLoad,   setCrawlerLoad]   = useState(false);
  const [sseConnected,  setSseConnected]  = useState(false);

  const esRef = useRef(null);

  // ── SSE connection ─────────────────────────────────────────────────────────
  useEffect(() => {
    let es;
    let retryTimeout;

    function connect() {
      es = new EventSource(`${BASE}/api/events`);
      esRef.current = es;

      es.onopen = () => setSseConnected(true);

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        // Reconnect after 5 s
        retryTimeout = setTimeout(connect, 5000);
      };

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { event, data, activity: initActivity } = payload;

          // Initial snapshot
          if (event === 'connected' && initActivity) {
            setActivity(initActivity);
          }

          if (!event) return;

          if (event === 'crawler:started')   setCrawlerStatus('running');
          if (event === 'crawler:completed') { setCrawlerStatus('stopped'); setProgress(null); }
          if (event === 'crawler:stopped')   { setCrawlerStatus('stopped'); setProgress(null); }
          if (event === 'crawler:error')     { setCrawlerStatus('stopped'); setProgress(null); }

          if (event === 'crawler:progress' && data) {
            setProgress(data);
          }

          const historyEvents = new Set([
            'crawler:deal-posted', 'crawler:deal-skipped', 'crawler:deal-error',
            'crawler:started', 'crawler:completed', 'crawler:stopped', 'crawler:error',
          ]);
          if (historyEvents.has(event) && data) {
            setActivity(prev => [data, ...prev].slice(0, 50));
          }
        } catch {}
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      es?.close();
      setSseConnected(false);
    };
  }, []);

  // ── Bootstrap auto mode + crawler status ───────────────────────────────────
  useEffect(() => {
    systemApi.getAutoMode()
      .then(d => setAutoMode(d?.enabled ?? false))
      .catch(() => {})
      .finally(() => setAutoLoading(false));

    crawlerApi.status()
      .then(d => setCrawlerStatus(d?.status || (d?.running ? 'running' : 'stopped')))
      .catch(() => {});
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const startCrawler = useCallback(async () => {
    setCrawlerLoad(true);
    setCrawlerStatus('running'); // optimistic
    try {
      await crawlerApi.start();
    } catch (e) {
      if (!e?.message?.includes('already')) setCrawlerStatus('stopped');
    }
    setCrawlerLoad(false);
  }, []);

  const stopCrawler = useCallback(async () => {
    setCrawlerLoad(true);
    setCrawlerStatus('stopping'); // optimistic
    try {
      await crawlerApi.stop();
    } catch {
      setCrawlerStatus('running');
    }
    setCrawlerLoad(false);
  }, []);

  const toggleAutoMode = useCallback(async (val) => {
    setAutoLoading(true);
    setAutoMode(val); // optimistic
    try {
      await systemApi.setAutoMode(val);
    } catch {
      setAutoMode(!val); // rollback
    }
    setAutoLoading(false);
  }, []);

  return (
    <CrawlerContext.Provider value={{
      crawlerStatus,
      progress,
      activity,
      autoMode,
      autoLoading,
      crawlerLoad,
      sseConnected,
      startCrawler,
      stopCrawler,
      toggleAutoMode,
    }}>
      {children}
    </CrawlerContext.Provider>
  );
}

export function useCrawler() {
  const ctx = useContext(CrawlerContext);
  if (!ctx) throw new Error('useCrawler must be used inside <CrawlerProvider>');
  return ctx;
}
