import React from 'react';
import { KpiData, KpiChangeType } from '../types';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const iconMap: { [key in KpiChangeType]: React.ElementType } = {
  increase: ArrowUpRight,
  decrease: ArrowDownRight,
  neutral: Minus,
};

const colorMap: { [key in KpiChangeType]: string } = {
  increase: 'text-red-500', // Complaint rate increase is bad
  decrease: 'text-green-400',
  neutral: 'text-gray-400',
};

// Special handling for "good" increases
const goodIncreaseTitles = ['Delivery Rate'];

const KPITile: React.FC<KpiData> = ({ title, value, change, changeType, period }) => {
  if (!title || !value) {
    return null;
  }

  let finalColor = colorMap[changeType];
  if (goodIncreaseTitles.includes(title) && changeType === 'increase') {
    finalColor = 'text-green-400';
  }
   if (goodIncreaseTitles.includes(title) && changeType === 'decrease') {
    finalColor = 'text-red-500';
  }

  const Icon = iconMap[changeType];

  return (
    <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 shadow-md transform hover:-translate-y-1 transition-transform duration-200">
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <p className="text-2xl font-bold text-white">{value}</p>
        <div className={`flex items-center text-sm font-semibold ${finalColor}`}>
          <Icon className="h-4 w-4 mr-1" />
          <span>{change}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1">{period}</p>
    </div>
  );
};

export default KPITile;