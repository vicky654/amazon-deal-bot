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
    <div className="min-h-screen bg-gray-50/50 p-4 lg:p-8">
      
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Search size={22} />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Smart Deal Finder</h1>
            </div>
            <p className="text-gray-500 font-medium">Discover real discounts using historical pricing and AI analysis.</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <List size={20} />
            </button>
          </div>
        </div>

        {/* Featured Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          
          {/* Trending Hot Deals */}
          <div className="bg-orange-50/30 rounded-3xl p-6 border border-orange-100/50 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <Flame className="text-orange-500" fill="currentColor" size={24} />
                <h2 className="text-xl font-black text-orange-900">Trending Hot Deals</h2>
              </div>
              <button className="text-xs font-bold text-orange-600 bg-white px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all">View All</button>
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
                <p className="text-sm text-orange-400 font-bold py-10 w-full text-center">No trending deals found yet.</p>
              )}
            </div>
          </div>

          {/* Lowest Price Ever */}
          <div className="bg-indigo-50/30 rounded-3xl p-6 border border-indigo-100/50 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <TrendingDown className="text-indigo-500" size={24} />
                <h2 className="text-xl font-black text-indigo-900">Lowest Price Ever</h2>
              </div>
              <button className="text-xs font-bold text-indigo-600 bg-white px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all">View All</button>
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
                <p className="text-sm text-indigo-400 font-bold py-10 w-full text-center">No lowest-ever prices detected yet.</p>
              )}
            </div>
          </div>

        </div>

        {/* Search & Filters */}
        <SmartFilters filters={filters} setFilters={setFilters} onSearch={handleSearch} />

        {/* Main Feed */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-blue-600" size={20} />
            <h2 className="text-xl font-black text-gray-900">Deal Explorer</h2>
            <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">
              {deals.length} RESULTS
            </span>
          </div>
          
          <button 
            onClick={handleSearch}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-blue-600 transition-all"
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
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-300" size={40} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No deals found matching filters</h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">Try adjusting your filters or keyword to find what you're looking for.</p>
          </div>
        )}

      </div>
    </div>
  );
}
