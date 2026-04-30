'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  RefreshCw, 
  LayoutGrid, 
  List, 
  AlertCircle,
  ArrowRight,
  TrendingDown,
  Award,
  Search,
  Filter,
  PackageSearch,
  ChevronRight,
  Zap,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dealsApi, crawlerApi } from '@/lib/api';
import SmartDealCard from './SmartDealCard';
import SmartFilters from './SmartFilters';
import LoadingSkeleton from '@/components/LoadingSkeleton';

const SmartDealsFeed = ({ 
  title = "Smart Deal Finder", 
  subtitle = "Discover real discounts using historical pricing analysis.",
  initialFilters = {},
  showTrendingSection = false,
  showLowestEverSection = false,
}) => {
  const [deals, setDeals] = useState([]);
  const [trending, setTrending] = useState([]);
  const [lowestEver, setLowestEver] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  
  const [filters, setFilters] = useState({
    category: '',
    minScore: '',
    isVerified: false,
    isLowestEver: false,
    sort: 'newest',
    q: '',
    ...initialFilters
  });

  const loadMoreRef = useRef(null);

  const fetchData = useCallback(async (isInitial = true) => {
    if (isInitial) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentPage = isInitial ? 1 : page + 1;
      const promises = [dealsApi.explore({ ...filters, page: currentPage, limit: 20 })];
      
      if (isInitial) {
        if (showTrendingSection) promises.push(dealsApi.trending());
        if (showLowestEverSection) promises.push(dealsApi.lowestEver());
        promises.push(crawlerApi.status().catch(() => null));
      }

      const results = await Promise.all(promises);
      const exploreData = results[0];
      
      if (isInitial) {
        setDeals(exploreData.deals || []);
        setTotal(exploreData.total || 0);
        
        let idx = 1;
        if (showTrendingSection) setTrending(results[idx++].deals || []);
        if (showLowestEverSection) setLowestEver(results[idx++].deals || []);
        setCrawlerStatus(results[idx]);
      } else {
        setDeals(prev => [...prev, ...(exploreData.deals || [])]);
        setPage(currentPage);
      }

      setHasMore(exploreData.deals?.length === 20);

    } catch (err) {
      console.error('[Feed] Failed to fetch deals:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filters, page, showTrendingSection, showLowestEverSection]);

  useEffect(() => {
    fetchData(true);
  }, [filters]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchData(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchData]);

  const resetFilters = () => {
    setFilters({
      category: '',
      minScore: '',
      isVerified: false,
      isLowestEver: false,
      sort: 'newest',
      q: '',
      ...initialFilters
    });
  };

  return (
    <div className="max-w-7xl mx-auto pb-24 px-4 sm:px-6">
      
      {/* Dynamic Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight leading-none">{title}</h1>
            <AnimatePresence>
              {crawlerStatus?.running && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full border border-primary/20 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  LIVE ANALYSIS
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-muted-foreground font-bold text-lg max-w-xl leading-relaxed">{subtitle}</p>
        </motion.div>
        
        <div className="flex items-center gap-3 bg-surface/80 p-1.5 rounded-[1.25rem] border border-border shadow-sm backdrop-blur-xl">
          <div className="px-3 py-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden sm:block">View Mode</div>
          <div className="flex gap-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              <List size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Featured Horizontal Scrollers */}
      {(showTrendingSection || showLowestEverSection) && (
        <div className="flex flex-col gap-12 mb-16">
          {showTrendingSection && trending.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                    <Zap size={22} fill="currentColor" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground leading-none mb-1">Flash Trending</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Calculated from last 24h performance</p>
                  </div>
                </div>
                <button className="p-2 text-muted-foreground hover:text-primary transition-all">
                  <ChevronRight size={24} />
                </button>
              </div>
              
              <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide no-scrollbar snap-x cursor-grab active:cursor-grabbing">
                {trending.map(deal => (
                  <div key={deal._id} className="min-w-[300px] sm:min-w-[340px] snap-center">
                    <SmartDealCard deal={deal} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Primary Discovery Section */}
      <SmartFilters filters={filters} setFilters={setFilters} onSearch={() => fetchData(true)} />

      {/* Results Meta */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-2xl border border-border">
            <Filter className="text-primary" size={16} />
            <h2 className="text-xs font-black text-foreground uppercase tracking-tight">Marketplace results</h2>
            <span className="bg-accent text-primary text-[10px] font-black px-2 py-0.5 rounded-lg ml-2">
              {total.toLocaleString()} PRODUCTS
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-[10px] font-black text-muted-foreground hover:text-primary transition-all uppercase tracking-[0.2em] group"
        >
          <RefreshCw size={14} className={`${refreshing ? 'animate-spin' : ''} group-hover:rotate-180 transition-transform duration-500`} />
          Sync live feed
        </button>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          >
            {Array(8).fill(0).map((_, i) => <LoadingSkeleton key={i} />)}
          </motion.div>
        ) : deals.length > 0 ? (
          <motion.div 
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`grid gap-8 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 max-w-4xl mx-auto'}`}
          >
            {deals.map((deal, idx) => (
              <SmartDealCard key={`${deal._id}-${idx}`} deal={deal} />
            ))}
            
            {/* Infinite Scroll Anchor */}
            {hasMore && (
              <div ref={loadMoreRef} className="col-span-full py-20 flex justify-center">
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="animate-spin text-primary" size={32} />
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Scanning more deals...</p>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-32 bg-surface/50 rounded-[3rem] border border-dashed border-border backdrop-blur-sm"
          >
            <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mx-auto mb-8 border border-border shadow-sm">
              <PackageSearch className="text-muted-foreground" size={48} />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-3">No matching discoveries found</h3>
            <p className="text-muted-foreground font-bold text-sm max-w-sm mx-auto mb-10 leading-relaxed">
              We couldn't find any deals matching your current filters. Try relaxing your constraints or resetting to our featured trending list.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 px-6">
              <button 
                onClick={resetFilters}
                className="px-8 py-4 bg-secondary hover:bg-secondary-hover text-secondary-foreground rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                Reset Filters
              </button>
              <button 
                onClick={() => setFilters({ ...filters, minScore: '', isVerified: false })}
                className="px-8 py-4 bg-primary hover:bg-primary-hover text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm"
              >
                Discover Trending
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default SmartDealsFeed;
