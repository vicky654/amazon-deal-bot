import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

/**
 * Mini Price Trend Chart for Deal Cards
 */
const PriceTrendChart = ({ data, height = 120, color = "#2563eb" }) => {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center bg-slate-900 rounded" style={{ height }}>
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">No trend data</p>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp || point.recordedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    price: point.price,
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
          <XAxis 
            dataKey="time" 
            hide={true}
          />
          <YAxis 
            hide={true} 
            domain={['dataMin - 100', 'dataMax + 100']} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#020617', 
              borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.05)', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' 
            }}
            labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}
            itemStyle={{ fontSize: '12px', color: color, fontWeight: '900' }}
            formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Price']}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={color} 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceTrendChart;
