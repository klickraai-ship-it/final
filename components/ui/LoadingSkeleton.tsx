import React from 'react';

export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-700 rounded ${className}`} />
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl">
    <div className="space-y-4">
      <LoadingSkeleton className="h-6 w-3/4" />
      <LoadingSkeleton className="h-4 w-1/2" />
      <div className="space-y-2">
        <LoadingSkeleton className="h-3 w-full" />
        <LoadingSkeleton className="h-3 w-5/6" />
      </div>
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <LoadingSkeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton className="h-4 w-1/4" />
            <LoadingSkeleton className="h-3 w-1/3" />
          </div>
          <LoadingSkeleton className="h-8 w-24" />
        </div>
      </div>
    ))}
  </div>
);

export const KPISkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl">
        <div className="space-y-3">
          <LoadingSkeleton className="h-4 w-1/2" />
          <LoadingSkeleton className="h-8 w-3/4" />
          <LoadingSkeleton className="h-3 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);
