'use client';

import React from 'react';
import SmartDealsFeed from '@/components/smart-deals/SmartDealsFeed';

export default function SmartDealsPage() {
  return (
    <div className="p-4 lg:p-8 min-h-screen bg-transparent">
      <SmartDealsFeed 
        title="Amazon Best Deals" 
        subtitle="AI-powered discovery of price drops, historical lows, and secret Amazon discounts across all categories."
        showTrendingSection={true}
        showLowestEverSection={true}
      />
    </div>
  );
}
