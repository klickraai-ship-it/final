import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DomainPerformance {
  name: string;
  deliveryRate: number;
  complaintRate: number;
  spamRate: number;
}

interface DomainPerformanceChartProps {
  data: DomainPerformance[];
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-700 p-3 rounded-md border border-gray-600 shadow-lg">
        <p className="font-semibold text-white">{label}</p>
        <p className="text-sm text-cyan-400">{`Delivery: ${payload[0].value.toFixed(2)}%`}</p>
        <p className="text-sm text-amber-400">{`Complaints: ${payload[1].value.toFixed(2)}%`}</p>
        <p className="text-sm text-red-400">{`Spam Reports: ${payload[2].value.toFixed(2)}%`}</p>
      </div>
    );
  }
  return null;
};


const DomainPerformanceChart: React.FC<DomainPerformanceChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No domain performance data available
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
           <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} stroke="#4B5563" />
          <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(75, 85, 99, 0.3)' }} />
          <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}}/>
          <Bar dataKey="deliveryRate" name="Delivery Rate" fill="#22D3EE" barSize={15} radius={[4, 4, 0, 0]} />
          <Bar dataKey="complaintRate" name="Complaint Rate" fill="#FBBF24" barSize={15} radius={[4, 4, 0, 0]} />
          <Bar dataKey="spamRate" name="Spam Rate" fill="#F87171" barSize={15} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DomainPerformanceChart;