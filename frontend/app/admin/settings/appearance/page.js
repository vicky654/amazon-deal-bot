'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const themes = [
    {
      id: 'light',
      label: 'Light',
      icon: Sun,
      description: 'Classic clean look for bright environments.',
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: Moon,
      description: 'Modern sleek look that is easy on the eyes.',
    },
    {
      id: 'system',
      label: 'System',
      icon: Monitor,
      description: 'Automatically adjust based on your OS settings.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight mb-2">Appearance</h1>
        <p className="text-muted-foreground font-medium">
          Customize how DealBot looks on your device.
        </p>
      </div>

      <Card className="overflow-hidden border-border shadow-sm">
        <CardHeader className="bg-accent/50 border-b border-border">
          <CardTitle>Interface Theme</CardTitle>
          <CardDescription>
            Select your preferred theme for the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {themes.map((t) => {
              const active = theme === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    'relative flex flex-col items-start p-5 rounded-2xl border-2 transition-all text-left group',
                    active
                      ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
                      : 'border-border hover:border-border-strong hover:bg-accent'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground group-hover:text-foreground'
                  )}>
                    <Icon size={20} />
                  </div>
                  
                  <div className="font-black text-sm mb-1 flex items-center gap-2">
                    {t.label}
                    {active && <Check size={14} className="text-primary" />}
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            This is how your components will look with the current theme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-xs">Primary Button</div>
            <div className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-bold text-xs">Secondary Button</div>
            <div className="px-4 py-2 border border-border text-foreground rounded-lg font-bold text-xs">Outline Button</div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="px-2 py-1 bg-success/10 text-success text-[10px] font-black rounded-full border border-success/20">SUCCESS</div>
            <div className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-black rounded-full border border-warning/20">WARNING</div>
            <div className="px-2 py-1 bg-danger/10 text-danger text-[10px] font-black rounded-full border border-danger/20">DANGER</div>
          </div>
          
          <div className="p-4 rounded-xl bg-accent border border-border">
            <p className="text-sm font-medium text-foreground">
              Semantic tokens allow for automatic theme switching while maintaining consistent contrast and aesthetics.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
