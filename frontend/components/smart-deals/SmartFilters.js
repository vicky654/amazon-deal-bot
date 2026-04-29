import React from 'react';
import { Filter, Search, X, Check, Star, TrendingDown, Award, Sparkles } from 'lucide-react';

const SmartFilters = ({ filters, setFilters, onSearch }) => {
  const categories = [
    'Mobiles', 'Electronics', 'Laptops', 'Shoes', 'Clothing', 'Beauty', 'Fitness', 'Home-Kitchen', 'Gaming'
  ];

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      minScore: '',
      isVerified: false,
      isLowestEver: false,
      isPrime: false,
      inStock: false,
      maxPrice: 50000,
      sort: 'newest',
      q: ''
    });
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl p-6 mb-10 overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex flex-col lg:flex-row gap-6 relative z-10">
        
        {/* Search Input */}
        <div className="flex-grow">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text"
              placeholder="Search by product, brand or ASIN..."
              className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-orange-500/50 transition-all outline-none text-sm text-white placeholder-slate-600"
              value={filters.q}
              onChange={(e) => updateFilter('q', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 relative z-10">
          <button 
            onClick={onSearch}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
          >
            REFRESH RESULTS
          </button>
          <button 
            onClick={clearFilters}
            className="bg-slate-800 hover:bg-slate-700 text-slate-400 p-4 rounded-2xl transition-all border border-white/5"
            title="Clear All"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 relative z-10">
        
        {/* Category & Brand */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Category</label>
            <select 
              value={filters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
              className="w-full p-3.5 bg-slate-950/50 border border-white/5 rounded-xl text-sm text-slate-300 outline-none cursor-pointer focus:border-orange-500/30"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c.toLowerCase()}>{c}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Price Range (Max)</label>
            <div className="flex items-center gap-3">
              <input 
                type="range"
                min="0"
                max="50000"
                step="500"
                value={filters.maxPrice || 50000}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
                className="flex-grow accent-orange-500"
              />
              <span className="text-xs font-bold text-orange-400 w-16">₹{filters.maxPrice || '50k+'}</span>
            </div>
          </div>
        </div>

        {/* Score & Quality */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 text-center block">Min Deal Score</label>
            <div className="flex gap-2">
              {[60, 75, 90].map(score => (
                <button
                  key={score}
                  onClick={() => updateFilter('minScore', filters.minScore === score ? '' : score)}
                  className={`flex-grow py-3 rounded-xl text-xs font-black transition-all border ${
                    filters.minScore === score 
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 shadow-lg shadow-orange-500/5' 
                    : 'bg-slate-950/50 border-white/5 text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                  }`}
                >
                  {score}+
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => updateFilter('isVerified', !filters.isVerified)}
            className={`w-full py-3.5 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${
              filters.isVerified 
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
              : 'bg-slate-950/50 border-white/5 text-slate-500 hover:bg-slate-900'
            }`}
          >
            <Award size={14} />
            VERIFIED ONLY
          </button>
        </div>

        {/* Status & Prime */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Deal Status</label>
          <button
            onClick={() => updateFilter('isLowestEver', !filters.isLowestEver)}
            className={`w-full py-3 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${
              filters.isLowestEver 
              ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' 
              : 'bg-slate-950/50 border-white/5 text-slate-500 hover:bg-slate-900'
            }`}
          >
            <TrendingDown size={14} />
            LOWEST PRICE
          </button>
          
          <button
            onClick={() => updateFilter('isPrime', !filters.isPrime)}
            className={`w-full py-3 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${
              filters.isPrime 
              ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' 
              : 'bg-slate-950/50 border-white/5 text-slate-500 hover:bg-slate-900'
            }`}
          >
            <Sparkles size={14} />
            PRIME DEALS
          </button>
        </div>

        {/* Availability & Sort */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Sort By</label>
            <select 
              value={filters.sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="w-full p-3.5 bg-slate-950/50 border border-white/5 rounded-xl text-sm text-slate-300 outline-none cursor-pointer focus:border-orange-500/30"
            >
              <option value="newest">Recently Added</option>
              <option value="score">Best Deal Score</option>
              <option value="discount">Highest Discount</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="drop">Biggest Price Drop</option>
            </select>
          </div>

          <button
            onClick={() => updateFilter('inStock', !filters.inStock)}
            className={`w-full py-3.5 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${
              filters.inStock 
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400' 
              : 'bg-slate-950/50 border-white/5 text-slate-500 hover:bg-slate-900'
            }`}
          >
            IN STOCK ONLY
          </button>
        </div>

      </div>
    </div>
  );
};

export default SmartFilters;
