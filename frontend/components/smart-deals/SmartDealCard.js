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
  Flame
} from 'lucide-react';
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
    avg30dPrice,
    couponInfo,
    platform,
    link,
    affiliateLink
  } = deal;

  const isLowestEver = lowestPrice && price <= lowestPrice;
  const isHotDeal    = dealScore >= 80;
  const savingsAmount = originalPrice ? originalPrice - price : 0;
  
  // Format currency
  const fmt = (val) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);

  return (
    <div className="bg-slate-900 rounded-3xl border border-white/5 shadow-sm hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500 overflow-hidden flex flex-col group relative">
      {/* Badge Overlay */}
      <div className="relative">
        <div className="aspect-square overflow-hidden bg-slate-950/30 flex items-center justify-center p-6">
          <img 
            src={image || '/placeholder-product.png'} 
            alt={title}
            className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        </div>
        
        {/* Top Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          {discount && (
            <div className="bg-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xl">
              <TrendingDown size={12} strokeWidth={3} />
              {discount}% OFF
            </div>
          )}
          {isHotDeal && (
            <div className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xl">
              <Flame size={12} fill="currentColor" />
              HOT DEAL
            </div>
          )}
        </div>

        {/* Status Badges (Right) */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          {isVerifiedDeal && (
            <div className="bg-emerald-500 text-white p-1.5 rounded-xl shadow-xl border border-emerald-400/20" title="Verified Deal">
              <ShieldCheck size={16} strokeWidth={2.5} />
            </div>
          )}
          {isLightningDeal && (
            <div className="bg-yellow-400 text-slate-950 p-1.5 rounded-xl shadow-xl border border-yellow-200/20" title="Lightning Deal">
              <Zap size={16} fill="currentColor" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-grow flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">{brand || platform}</span>
            <h3 className="text-sm font-bold text-slate-200 line-clamp-2 leading-snug group-hover:text-orange-400 transition-colors">
              {title}
            </h3>
          </div>
          <div className={`shrink-0 w-10 h-10 rounded-2xl border flex flex-col items-center justify-center ${
            dealScore >= 80 ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-slate-800 border-white/5 text-slate-500'
          }`}>
            <span className="text-[8px] font-black leading-none mb-0.5 opacity-60">SCORE</span>
            <span className="text-xs font-black leading-none">{dealScore || 0}</span>
          </div>
        </div>

        {/* Ratings */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-black border border-emerald-500/10">
            {rating || '0.0'} <Star size={10} fill="currentColor" className="ml-1" />
          </div>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{(reviewCount || 0).toLocaleString()} REVIEWS</span>
        </div>

        <div className="h-px bg-white/5" />

        {/* Pricing */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Deal Price</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white">{fmt(price)}</span>
              {originalPrice && (
                <span className="text-xs text-slate-600 line-through font-bold">{fmt(originalPrice)}</span>
              )}
            </div>
          </div>
          {savingsAmount > 0 && (
            <div className="text-right">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1 block">Savings</span>
              <span className="text-sm font-black text-emerald-500">-{fmt(savingsAmount)}</span>
            </div>
          )}
        </div>

        {/* Price History Preview */}
        <div className="bg-slate-950/50 rounded-2xl p-3 border border-white/5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
              <Clock size={10} /> 30D Price Trend
            </span>
            {isLowestEver && (
              <span className="text-[8px] font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg shadow-blue-600/20">
                LOWEST EVER
              </span>
            )}
          </div>
          <PriceTrendChart data={deal.priceHistory} height={60} color={isLowestEver ? "#2563eb" : "#f97316"} />
        </div>

        {couponInfo && (
          <div className="bg-blue-500/5 text-blue-400 p-2.5 rounded-xl text-[11px] font-bold flex items-start gap-2 border border-blue-500/10 italic">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>{couponInfo}</span>
          </div>
        )}
      </div>

      {/* Footer / CTA */}
      <div className="p-5 pt-0 mt-auto">
        <a 
          href={affiliateLink || link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full bg-slate-100 hover:bg-white text-slate-950 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-950/20 active:scale-[0.98]"
        >
          Buy on {platform === 'amazon' ? 'Amazon' : platform.charAt(0).toUpperCase() + platform.slice(1)}
          <ArrowRight size={14} strokeWidth={3} />
        </a>
      </div>
    </div>
  );
};

export default SmartDealCard;
