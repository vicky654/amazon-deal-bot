'use client';

import React from 'react';
import SmartDealsFeed from '@/components/smart-deals/SmartDealsFeed';

export default function SmartDealsPage() {
  return (
    <div className="p-4 lg:p-8 min-h-screen bg-transparent">
      <SmartDealsFeed 
        title="Smart Deal Discovery" 
        subtitle="Our AI engine scans thousands of products to find real price drops and historical lows."
        showTrendingSection={true}
        showLowestEverSection={true}
      />
    </div>
  );
}
