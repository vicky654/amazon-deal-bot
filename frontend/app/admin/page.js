'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { dashboardApi } from '../../lib/api';
import {
  MousePointerClick, Package, Send, Star, RefreshCw,
  AlertTriangle, TrendingUp, Clock, Activity, CheckCircle2,
  XCircle, Zap, ChevronRight, Flame, ArrowUpRight
} from 'lucide-react';
import AutoModeWidget from '../../components/AutoModeWidget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const REFRESH_MS = 30_000;

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)  return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function fmt(n) {
  return n != null ? Number(n).toLocaleString('en-IN') : '—';
}

function platformEmoji(p) {
  return { amazon: '🛒', flipkart: '🟡', myntra: '👗', ajio: '👠' }[p] || '🛍️';
}

function StatCard({ icon: Icon, label, value, sub, color = 'primary' }) {
  const colorMap = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    success: 'text-success bg-success/10 border-success/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
  };

  return (
    <Card className="relative overflow-hidden group border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2 rounded-xl border transition-colors", colorMap[color] || colorMap.primary)}>
            <Icon size={20} />
          </div>
          {sub && <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{sub}</span>}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
        </div>
      </CardContent>
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
    </Card>
  );
}

function ScorePill({ score }) {
  const variant = score >= 75 ? 'warning' : score >= 50 ? 'success' : score >= 30 ? 'secondary' : 'outline';
  const label = score >= 75 ? 'Hot' : score >= 50 ? 'Good' : score >= 30 ? 'Decent' : 'Weak';
  
  return (
    <Badge variant={variant} className="text-[9px] font-black px-2 py-0">
      {label}
    </Badge>
  );
}

const QUICK_LINKS = [
  { href: '/admin/generate', emoji: '➕', label: 'Generate', color: 'primary' },
  { href: '/admin/deals', emoji: '📦', label: 'Deals', color: 'blue' },
  { href: '/admin/analytics', emoji: '📈', label: 'Analytics', color: 'success' },
  { href: '/admin/crawler', emoji: '⚙️', label: 'Crawler', color: 'warning' },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshedAt, setRefAt] = useState(null);
  const timerRef = useRef(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await dashboardApi.get();
      setData(res);
      setError(null);
      setRefAt(new Date());
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    timerRef.current = setInterval(fetchDashboard, REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchDashboard]);

  const skeleton = loading && !data;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in">
      
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
              <Flame size={24} fill="currentColor" />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight leading-none">Dashboard</h1>
          </div>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            {refreshedAt ? `System synchronized ${timeAgo(refreshedAt.toISOString())}` : 'Synchronizing system...'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboard}
            isLoading={loading}
            className="rounded-xl border-border bg-surface shadow-sm"
          >
            <RefreshCw size={14} className={cn("mr-2", loading && "animate-spin")} />
            Sync Now
          </Button>
          <Link href="/admin/smart-deals">
            <Button size="sm" className="rounded-xl shadow-lg shadow-primary/20">
              Explore Deals
              <ArrowUpRight size={14} className="ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-2xl flex items-center gap-3">
          <AlertTriangle size={20} />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {skeleton ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <StatCard icon={MousePointerClick} label="Total Clicks" value={fmt(data?.totalClicks)} sub="Performance" color="primary" />
            <StatCard icon={Package} label="Total Deals" value={fmt(data?.totalDeals)} sub="Inventory" color="blue" />
            <StatCard icon={Send} label="Posted Deals" value={fmt(data?.postedDeals)} sub="Reach" color="success" />
            <StatCard icon={Star} label="Avg Score" value={data?.avgScore ?? '—'} sub="Quality" color="warning" />
          </>
        )}
      </div>

      {/* ── Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Top Deals - Left Column (8 units) */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-accent/30 border-b border-border py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-primary" />
                  <CardTitle className="text-base uppercase tracking-widest font-black text-muted-foreground">Top Performing Deals</CardTitle>
                </div>
                <Link href="/admin/analytics" className="text-xs font-black text-primary hover:underline flex items-center gap-1 uppercase tracking-widest">
                  View Analytics <ChevronRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {skeleton ? (
                <div className="p-6 space-y-4">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : !data?.topDeals?.length ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                  <MousePointerClick size={40} className="opacity-20" />
                  <p className="font-bold">No engagement data available yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {data.topDeals.map((deal, i) => (
                    <div key={deal._id} className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors group cursor-pointer">
                      <span className="w-6 h-6 rounded-lg bg-accent text-muted-foreground text-xs font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      {deal.image && (
                        <div className="w-12 h-12 bg-white rounded-xl border border-border p-1.5 flex items-center justify-center shrink-0">
                          <img src={deal.image} alt="" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{deal.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <ScorePill score={deal.score || 0} />
                          <span className="text-[10px] font-black text-muted-foreground uppercase">{platformEmoji(deal.platform)} {deal.platform}</span>
                          {deal.discount > 0 && <Badge variant="success" className="text-[9px] font-black">-{deal.discount}%</Badge>}
                        </div>
                      </div>
                      <div className="bg-primary/5 text-primary border border-primary/10 rounded-xl px-3 py-1.5 flex flex-col items-center shrink-0 min-w-[60px]">
                        <span className="text-[10px] font-black uppercase opacity-60">Clicks</span>
                        <span className="text-sm font-black">{deal.clicks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="bg-accent/30 border-b border-border py-4">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                <CardTitle className="text-base uppercase tracking-widest font-black text-muted-foreground">Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {skeleton ? (
                <div className="p-6 space-y-4">
                  {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
              ) : (
                <div className="divide-y divide-border">
                   {data.recentDeals?.map((deal) => (
                    <div key={deal._id} className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors">
                      <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-lg shrink-0">
                        {platformEmoji(deal.platform)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{deal.title}</p>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">{timeAgo(deal.createdAt)} · {deal.platform}</p>
                      </div>
                      <Badge variant={deal.posted ? "success" : "secondary"} className="text-[10px] font-black">
                        {deal.posted ? "POSTED" : "SAVED"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Right Column (4 units) */}
        <div className="lg:col-span-4 space-y-8">
          <Section icon={Activity} title="System Health">
            {skeleton ? (
              <Skeleton className="h-48 rounded-2xl" />
            ) : (
              <Card className="border-border shadow-sm">
                <CardContent className="p-4 space-y-3">
                  {[
                    { label: 'MongoDB', ok: data.systemStatus?.mongodb?.ok, status: data.systemStatus?.mongodb?.status },
                    { label: 'Telegram Bot', ok: data.systemStatus?.telegram?.ok, status: data.systemStatus?.telegram?.ok ? 'Connected' : 'Disconnected' },
                    { label: 'EarnKaro API', ok: data.systemStatus?.earnkaro?.ok, status: data.systemStatus?.earnkaro?.ok ? 'Ready' : 'Expired' },
                    { label: 'Crawler Cron', ok: data.systemStatus?.cron?.ok, status: data.systemStatus?.cron?.running ? 'Running' : 'Standby' },
                  ].map((item) => (
                    <div key={item.label} className={cn(
                      "flex items-center justify-between p-3 rounded-xl border",
                      item.ok ? "bg-success/5 border-success/10" : "bg-danger/5 border-danger/10"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full shadow-sm", item.ok ? "bg-success" : "bg-danger")} />
                        <span className="text-xs font-bold text-foreground">{item.label}</span>
                      </div>
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", item.ok ? "text-success" : "text-danger")}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                  
                  {data.systemStatus?.queue && (
                    <div className="p-3 bg-accent/50 border border-border rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-primary" />
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Job Queue</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-black">{data.systemStatus.queue.pending} PENDING</Badge>
                        <Badge variant="primary" className="text-[10px] font-black">{data.systemStatus.queue.active} ACTIVE</Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </Section>

          <Section icon={Zap} title="Quick Actions">
             <div className="space-y-4">
               <AutoModeWidget />
               <div className="grid grid-cols-2 gap-3">
                 {QUICK_LINKS.map((link) => (
                   <Link key={link.href} href={link.href}>
                     <button className="w-full flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface border border-border hover:border-primary/50 hover:bg-accent transition-all group active:scale-95 shadow-sm">
                       <span className="text-2xl group-hover:scale-110 transition-transform">{link.emoji}</span>
                       <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest group-hover:text-foreground">{link.label}</span>
                     </button>
                   </Link>
                 ))}
               </div>
             </div>
          </Section>
        </div>

      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-primary" />
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}
