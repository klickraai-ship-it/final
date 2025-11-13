import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface SpamRateGaugeProps {
  value: number; // percentage (0-1)
}

const SpamRateGauge: React.FC<SpamRateGaugeProps> = ({ value }) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return (
      <div className="text-center text-gray-500 py-4">
        Invalid spam rate data
      </div>
    );
  }

  const percentageValue = value * 100;
  const data = [{ name: 'Spam Rate', value: percentageValue, fill: '#8884d8' }];

  const endAngle = 360 * (percentageValue / 0.5) > 360 ? 360 : 360 * (percentageValue / 0.5); // Max gauge at 0.5%

  let color = '#22C55E'; // Green
  if (value >= 0.10 && value < 0.30) {
    color = '#FBBF24'; // Yellow
  } else if (value >= 0.30) {
    color = '#EF4444'; // Red
  }

  return (
    <div className="h-56 w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="75%"
          outerRadius="95%"
          barSize={20}
          data={data}
          startAngle={180}
          endAngle={-180}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 50]} // 0.5% max
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background
            dataKey="value"
            angleAxisId={0}
            fill={color}
            cornerRadius={10}
          />
           <defs>
              <linearGradient id="gradientGreen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#16A34A" />
              </linearGradient>
              <linearGradient id="gradientYellow" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
              <linearGradient id="gradientRed" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="#DC2626" />
              </linearGradient>
           </defs>
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="text-4xl font-bold" style={{ color }}>
          {value.toFixed(2)}%
        </p>
        <p className="text-sm text-gray-400">Spam Rate</p>
      </div>
       <div className="absolute bottom-0 w-full flex justify-between text-xs text-gray-500 px-4">
        <span>0.0%</span>
        <span>0.10%</span>
        <span>0.30%</span>
        <span>0.5%+</span>
      </div>
      <div className="absolute bottom-4 w-full h-1.5 flex px-4">
        <div className="w-1/4 bg-green-500 rounded-l-full"></div>
        <div className="w-2/4 bg-yellow-500"></div>
        <div className="w-1/4 bg-red-500 rounded-r-full"></div>
      </div>
    </div>
  );
};

export default SpamRateGauge;