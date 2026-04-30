'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Flame, 
  TrendingDown, 
  CheckCircle2, 
  Search, 
  ArrowRight,
  RefreshCw,
  LayoutGrid,
  List
} from 'lucide-react';
import SmartDealCard from '@/components/smart-deals/SmartDealCard';
import SmartFilters from '@/components/smart-deals/SmartFilters';
import LoadingSkeleton from '@/components/LoadingSkeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://deal-system-backend.onrender.com';

export default function SmartExplorer() {
  const [deals, setDeals] = useState([]);
  const [trending, setTrending] = useState([]);
  const [lowestEver, setLowestEver] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  
  const [filters, setFilters] = useState({
    category: '',
    minScore: '',
    isVerified: false,
    isLowestEver: false,
    sort: 'newest',
    q: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trendingRes, lowestRes, mainRes] = await Promise.all([
        axios.get(`${API_URL}/api/deals/trending`),
        axios.get(`${API_URL}/api/deals/lowest-ever`),
        axios.get(`${API_URL}/api/deals`, { params: filters })
      ]);

      setTrending(trendingRes.data.deals || []);
      setLowestEver(lowestRes.data.deals || []);
      setDeals(mainRes.data.deals || []);
    } catch (err) {
      console.error('Failed to fetch smart deals:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8 animate-fade-in">
      
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                <Search size={22} />
              </div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Smart Deal Finder</h1>
            </div>
            <p className="text-muted-foreground font-medium">Discover real discounts using historical pricing and AI analysis.</p>
          </div>
          
          <div className="flex bg-surface p-1 rounded-xl border border-border shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-foreground text-background shadow-md' : 'text-muted-foreground hover:bg-accent'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-foreground text-background shadow-md' : 'text-muted-foreground hover:bg-accent'}`}
            >
              <List size={20} />
            </button>
          </div>
        </div>

        {/* Featured Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          
          {/* Trending Hot Deals */}
          <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <Flame className="text-primary" fill="currentColor" size={24} />
                <h2 className="text-xl font-black text-foreground">Trending Hot Deals</h2>
              </div>
              <button className="text-xs font-bold text-primary bg-surface px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all border border-border">View All</button>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {loading ? (
                Array(3).fill(0).map((_, i) => <div key={i} className="min-w-[280px] h-40 bg-white/50 rounded-2xl animate-pulse" />)
              ) : trending.length > 0 ? (
                trending.map(deal => (
                  <div key={deal._id} className="min-w-[300px] snap-center">
                    <SmartDealCard deal={deal} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-primary font-bold py-10 w-full text-center">No trending deals found yet.</p>
              )}
            </div>
          </div>

          {/* Lowest Price Ever */}
          <div className="bg-blue-500/5 rounded-3xl p-6 border border-blue-500/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <TrendingDown className="text-blue-500" size={24} />
                <h2 className="text-xl font-black text-foreground">Lowest Price Ever</h2>
              </div>
              <button className="text-xs font-bold text-blue-600 bg-surface px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all border border-border">View All</button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {loading ? (
                Array(3).fill(0).map((_, i) => <div key={i} className="min-w-[280px] h-40 bg-white/50 rounded-2xl animate-pulse" />)
              ) : lowestEver.length > 0 ? (
                lowestEver.map(deal => (
                  <div key={deal._id} className="min-w-[300px] snap-center">
                    <SmartDealCard deal={deal} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-blue-400 font-bold py-10 w-full text-center">No lowest-ever prices detected yet.</p>
              )}
            </div>
          </div>

        </div>

        {/* Search & Filters */}
        <SmartFilters filters={filters} setFilters={setFilters} onSearch={handleSearch} />

        {/* Main Feed */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary" size={20} />
            <h2 className="text-xl font-black text-foreground">Deal Explorer</h2>
            <span className="bg-accent text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">
              {deals.length} RESULTS
            </span>
          </div>
          
          <button 
            onClick={handleSearch}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-all"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh Feed
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
          <div className="text-center py-20 bg-surface rounded-3xl border border-dashed border-border shadow-sm">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-muted-foreground" size={40} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No deals found matching filters</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">Try adjusting your filters or keyword to find what you're looking for.</p>
          </div>
        )}

      </div>
    </div>
  );
}
