'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Toast from './Toast';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((message, type = 'success') => {
    clearTimeout(timerRef.current);
    // Force remount by using a unique key embedded in the object
    setToast({ message, type, _k: Date.now() });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <Toast key={toast?._k} toast={toast} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
