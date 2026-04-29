'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import SmartDealsFeed from '@/components/smart-deals/SmartDealsFeed';
import { Award, TrendingDown, Zap, Tag } from 'lucide-react';

const SLUG_CONFIG = {
  'trending': {
    title: 'Trending Hot Deals',
    subtitle: 'High-scoring deals that are currently popular and verified.',
    icon: Award,
    filters: { minScore: 70, sort: 'score' }
  },
  'lowest-price': {
    title: 'Lowest Price Ever',
    subtitle: 'Products that have hit their all-time lowest price recorded.',
    icon: TrendingDown,
    filters: { isLowestEver: true }
  },
  'lightning': {
    title: 'Lightning Deals',
    subtitle: 'Limited-time Amazon Lightning deals with deep discounts.',
    icon: Zap,
    filters: { isLightning: true }
  },
  'shoes': {
    title: 'Top Shoe Deals',
    subtitle: 'Best offers on sneakers, formal shoes, and sports footwear.',
    icon: Tag,
    filters: { category: 'shoes' }
  },
  'fashion': {
    title: 'Fashion & Apparel',
    subtitle: 'Huge savings on clothing, watches, and accessories.',
    icon: Tag,
    filters: { category: 'fashion' }
  },
  'electronics': {
    title: 'Electronics & Gadgets',
    subtitle: 'Laptops, headphones, and home electronics at best prices.',
    icon: Tag,
    filters: { category: 'electronics' }
  },
  'watches': {
    title: 'Premium Watches',
    subtitle: 'Deals on luxury and smartwatches.',
    icon: Tag,
    filters: { category: 'watches' }
  },
  'beauty': {
    title: 'Beauty & Personal Care',
    subtitle: 'Skincare, makeup, and grooming essentials.',
    icon: Tag,
    filters: { category: 'beauty' }
  },
  'home-kitchen': {
    title: 'Home & Kitchen',
    subtitle: 'Appliances and decor at smart prices.',
    icon: Tag,
    filters: { category: 'home-kitchen' }
  },
  'gaming': {
    title: 'Gaming & Entertainment',
    subtitle: 'Consoles, games, and PC accessories.',
    icon: Tag,
    filters: { category: 'gaming' }
  }
};

export default function SmartDealsSlugPage() {
  const { slug } = useParams();
  const config = SLUG_CONFIG[slug] || {
    title: `Discovery: ${slug}`,
    subtitle: `Smart deals found in ${slug} category.`,
    icon: Tag,
    filters: { category: slug }
  };

  const Icon = config.icon;

  return (
    <div className="p-4 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto mb-6 flex items-center gap-3">
        <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-400">
          <Icon size={24} />
        </div>
        <div className="h-px flex-grow bg-gradient-to-r from-orange-500/20 to-transparent" />
      </div>
      
      <SmartDealsFeed 
        title={config.title}
        subtitle={config.subtitle}
        initialFilters={config.filters}
      />
    </div>
  );
}
