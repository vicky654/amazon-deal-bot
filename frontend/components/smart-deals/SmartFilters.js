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
    <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-border shadow-sm p-6 mb-10 overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex flex-col lg:flex-row gap-6 relative z-10">

        {/* Search Input */}
        <div className="flex-grow">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search by product, brand or ASIN..."
              className="w-full pl-12 pr-4 py-4 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/50 transition-all outline-none text-sm text-foreground placeholder:text-muted-foreground"
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
            className="bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-[0.98]"
          >
            REFRESH RESULTS
          </button>
          <button
            onClick={clearFilters}
            className="bg-secondary hover:bg-secondary-hover text-secondary-foreground p-4 rounded-2xl transition-all border border-border"
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
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
              className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-foreground outline-none cursor-pointer focus:border-primary/30"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c.toLowerCase()}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Price Range (Max)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="50000"
                step="500"
                value={filters.maxPrice || 50000}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
                className="flex-grow accent-primary"
              />
              <span className="text-xs font-bold text-primary w-16">₹{filters.maxPrice || '50k+'}</span>
            </div>
          </div>
        </div>

        {/* Score & Quality */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 text-center block">Min Deal Score</label>
            <div className="flex gap-2">
              {[60, 75, 90].map(score => (
                <button
                  key={score}
                  onClick={() => updateFilter('minScore', filters.minScore === score ? '' : score)}
                  className={`flex-grow py-3 rounded-xl text-xs font-black transition-all border ${filters.minScore === score
                    ? 'bg-primary/10 border-primary/40 text-primary shadow-sm'
                    : 'bg-background border-border text-muted-foreground hover:bg-surface hover:text-foreground'
                    }`}
                >
                  {score}+
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => updateFilter('isVerified', !filters.isVerified)}
            className={`w-full py-3.5 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${filters.isVerified
              ? 'bg-success/10 border-success/40 text-success'
              : 'bg-background border-border text-muted-foreground hover:bg-surface'
              }`}
          >
            <Award size={14} />
            VERIFIED ONLY
          </button>
        </div>

        {/* Status & Prime */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Deal Status</label>
          <button
            onClick={() => updateFilter('isLowestEver', !filters.isLowestEver)}
            className={`w-full py-3 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${filters.isLowestEver
              ? 'bg-primary/10 border-primary/40 text-primary'
              : 'bg-background border-border text-muted-foreground hover:bg-surface'
              }`}
          >
            <TrendingDown size={14} />
            LOWEST PRICE
          </button>

          <button
            onClick={() => updateFilter('isPrime', !filters.isPrime)}
            className={`w-full py-3 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${filters.isPrime
              ? 'bg-primary/10 border-primary/40 text-primary'
              : 'bg-background border-border text-muted-foreground hover:bg-surface'
              }`}
          >
            <Sparkles size={14} />
            PRIME DEALS
          </button>
        </div>

        {/* Availability & Sort */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Sort By</label>
            <select
              value={filters.sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-foreground outline-none cursor-pointer focus:border-primary/30"
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
            className={`w-full py-3.5 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 ${filters.inStock
              ? 'bg-primary/10 border-primary/40 text-primary'
              : 'bg-background border-border text-muted-foreground hover:bg-surface'
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
