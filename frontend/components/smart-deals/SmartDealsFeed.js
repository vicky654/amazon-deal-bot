'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, 
  LayoutGrid, 
  List, 
  AlertCircle,
  ArrowRight,
  TrendingDown,
  Award,
  Search,
  Filter
} from 'lucide-react';
import { dealsApi, crawlerApi } from '@/lib/api';
import SmartDealCard from './SmartDealCard';
import SmartFilters from './SmartFilters';
import LoadingSkeleton from '@/components/LoadingSkeleton';

/**
 * SmartDealsFeed — The primary discovery orchestrator.
 * Handles fetching, filtering, and layout for all deal discovery pages.
 */
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
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  
  const [filters, setFilters] = useState({
    category: '',
    minScore: '',
    isVerified: false,
    isLowestEver: false,
    sort: 'newest',
    q: '',
    ...initialFilters
  });

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const promises = [dealsApi.list(filters)];
      
      if (showTrendingSection) promises.push(dealsApi.trending());
      if (showLowestEverSection) promises.push(dealsApi.lowestEver());
      promises.push(crawlerApi.status().catch(() => null));

      const results = await Promise.all(promises);
      
      setDeals(results[0].deals || []);
      
      let idx = 1;
      if (showTrendingSection) setTrending(results[idx++].deals || []);
      if (showLowestEverSection) setLowestEver(results[idx++].deals || []);
      setCrawlerStatus(results[idx]);

    } catch (err) {
      console.error('[Feed] Failed to fetch deals:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, showTrendingSection, showLowestEverSection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="max-w-7xl mx-auto">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-white tracking-tight">{title}</h1>
            {crawlerStatus?.running && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                LIVE CRAWLER
              </span>
            )}
          </div>
          <p className="text-slate-400 font-medium text-sm">{subtitle}</p>
        </div>
        
        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 shadow-sm backdrop-blur-md">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Conditional Featured Sections */}
      {(showTrendingSection || showLowestEverSection) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {showTrendingSection && (
            <div className="bg-orange-500/5 rounded-3xl p-6 border border-orange-500/10 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-2">
                  <Award className="text-orange-500" size={24} />
                  <h2 className="text-xl font-black text-white">Trending Hot Deals</h2>
                </div>
                <div className="text-[10px] font-bold text-orange-400 px-2 py-1 bg-orange-500/10 rounded-full">SCORE 80+</div>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                {loading ? (
                  Array(2).fill(0).map((_, i) => <div key={i} className="min-w-[280px] h-40 bg-white/5 rounded-2xl animate-pulse" />)
                ) : trending.length > 0 ? (
                  trending.map(deal => (
                    <div key={deal._id} className="min-w-[280px] snap-center">
                      <SmartDealCard deal={deal} />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 font-bold py-10 w-full text-center">No trending deals found.</p>
                )}
              </div>
            </div>
          )}

          {showLowestEverSection && (
            <div className="bg-blue-500/5 rounded-3xl p-6 border border-blue-500/10 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-2">
                  <TrendingDown className="text-blue-500" size={24} />
                  <h2 className="text-xl font-black text-white">Lowest Ever Prices</h2>
                </div>
                <div className="text-[10px] font-bold text-blue-400 px-2 py-1 bg-blue-500/10 rounded-full">HISTORICAL LOW</div>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                {loading ? (
                  Array(2).fill(0).map((_, i) => <div key={i} className="min-w-[280px] h-40 bg-white/5 rounded-2xl animate-pulse" />)
                ) : lowestEver.length > 0 ? (
                  lowestEver.map(deal => (
                    <div key={deal._id} className="min-w-[280px] snap-center">
                      <SmartDealCard deal={deal} />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 font-bold py-10 w-full text-center">No historical lows detected.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <SmartFilters filters={filters} setFilters={setFilters} onSearch={fetchData} />

      {/* Main Feed */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="text-orange-500" size={18} />
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">Active Results</h2>
          <span className="bg-slate-800 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full ml-2">
            {deals.length} ITEMS
          </span>
        </div>
        
        <button 
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 text-[11px] font-black text-slate-500 hover:text-orange-400 transition-all uppercase tracking-widest"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh results
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => <LoadingSkeleton key={i} />)}
        </div>
      ) : deals.length > 0 ? (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
          {deals.map(deal => (
            <SmartDealCard key={deal._id} deal={deal} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-slate-900/40 rounded-3xl border border-dashed border-white/5 backdrop-blur-sm">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="text-slate-600" size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No matching deals</h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">Try broadening your search or adjusting the filters to discover more products.</p>
        </div>
      )}

    </div>
  );
};

export default SmartDealsFeed;
