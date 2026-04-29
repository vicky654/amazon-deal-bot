'use client';

import React from 'react';
import { 
  TrendingDown, 
  Star, 
  CheckCircle, 
  ArrowRight, 
  Zap, 
  ShieldCheck, 
  Info,
  Clock,
  Flame,
  ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import PriceTrendChart from './PriceTrendChart';

const SmartDealCard = ({ deal }) => {
  const {
    title,
    brand,
    price,
    originalPrice,
    discount,
    image,
    rating,
    reviewCount,
    dealScore,
    isVerifiedDeal,
    isLightningDeal,
    lowestPrice,
    platform,
    link,
    affiliateLink,
    couponInfo
  } = deal;

  const isLowestEver = lowestPrice && price <= lowestPrice;
  const isHotDeal    = dealScore >= 80;
  const savingsAmount = originalPrice ? originalPrice - price : 0;
  
  const fmt = (val) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-slate-900/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 shadow-sm hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500 overflow-hidden flex flex-col group relative"
    >
      {/* Visual Header / Image */}
      <div className="relative p-2">
        <div className="aspect-[4/3] overflow-hidden bg-white rounded-[2rem] flex items-center justify-center p-6 relative">
          <img 
            src={image || '/placeholder-product.png'} 
            alt={title}
            loading="lazy"
            className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-700 ease-out"
          />
          
          {/* Overlay for quick info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        
        {/* Badges Layout */}
        <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
          {discount >= 40 && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-orange-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xl shadow-orange-600/40"
            >
              <TrendingDown size={12} strokeWidth={3} />
              {discount}% OFF
            </motion.div>
          )}
          {isHotDeal && (
            <div className="bg-white text-slate-950 text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xl">
              <Flame size={12} fill="currentColor" className="text-orange-600" />
              HOT DEAL
            </div>
          )}
        </div>

        <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
          {isVerifiedDeal && (
            <div className="bg-emerald-500 text-white p-2 rounded-2xl shadow-2xl border border-emerald-400/20" title="Verified Deal">
              <ShieldCheck size={16} strokeWidth={2.5} />
            </div>
          )}
          {isLightningDeal && (
            <div className="bg-yellow-400 text-slate-950 p-2 rounded-2xl shadow-2xl border border-yellow-200/20" title="Lightning Deal">
              <Zap size={16} fill="currentColor" />
            </div>
          )}
        </div>
      </div>

      {/* Product Information */}
      <div className="p-6 pt-2 flex-grow flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.15em] mb-1.5">{brand || platform}</span>
            <h3 className="text-sm font-bold text-slate-200 line-clamp-2 leading-relaxed group-hover:text-orange-400 transition-colors">
              {title}
            </h3>
          </div>
          <div className={`shrink-0 w-12 h-12 rounded-[1.25rem] border flex flex-col items-center justify-center transition-all group-hover:scale-110 ${
            dealScore >= 80 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-slate-800/50 border-white/5 text-slate-500'
          }`}>
            <span className="text-[8px] font-black leading-none mb-1 opacity-50 uppercase">Score</span>
            <span className="text-sm font-black leading-none">{dealScore || 0}</span>
          </div>
        </div>

        {/* Quality Signals */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800/80 text-white px-2.5 py-1 rounded-xl text-[10px] font-black border border-white/5">
            {rating || '4.0'} <Star size={10} fill="#f59e0b" stroke="#f59e0b" className="ml-1.5" />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{(reviewCount || 0).toLocaleString()} Reviews</span>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        {/* Price Engine Section */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Amazon Deal Price</span>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-black text-white tracking-tight">{fmt(price)}</span>
              {originalPrice && (
                <span className="text-xs text-slate-600 line-through font-bold opacity-60">{fmt(originalPrice)}</span>
              )}
            </div>
          </div>
          {savingsAmount > 0 && (
            <div className="text-right pb-0.5">
              <div className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest mb-1">Total Saved</div>
              <div className="text-sm font-black text-emerald-400">-{fmt(savingsAmount)}</div>
            </div>
          )}
        </div>

        {/* Insight Section */}
        <div className="bg-slate-950/40 rounded-[1.5rem] p-4 border border-white/5 mt-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Clock size={12} className="text-orange-500" /> 30D Analysis
            </span>
            {isLowestEver && (
              <span className="text-[9px] font-black text-white bg-blue-600 px-3 py-1 rounded-full shadow-lg shadow-blue-600/20">
                LOWEST EVER
              </span>
            )}
          </div>
          <div className="h-12 overflow-hidden">
            <PriceTrendChart data={deal.priceHistory} height={48} color={isLowestEver ? "#2563eb" : "#f97316"} />
          </div>
        </div>

        {couponInfo && (
          <div className="bg-orange-500/5 text-orange-400/80 p-3 rounded-2xl text-[11px] font-bold flex items-start gap-2.5 border border-orange-500/10">
            <Info size={14} className="shrink-0 mt-0.5 text-orange-500" />
            <span className="leading-snug">{couponInfo}</span>
          </div>
        )}
      </div>

      {/* Action Area */}
      <div className="p-6 pt-0">
        <a 
          href={affiliateLink || link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full bg-white hover:bg-orange-500 hover:text-white text-slate-950 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.98] group/btn"
        >
          Explore on Amazon
          <ExternalLink size={14} strokeWidth={3} className="group-hover/btn:translate-x-1 transition-transform" />
        </a>
      </div>

      {/* Decorative Glow */}
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-orange-500/10 transition-colors" />
    </motion.div>
  );
};

export default SmartDealCard;
