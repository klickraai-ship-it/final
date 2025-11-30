import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
        <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-700 shadow-xl">
          <Icon className="h-12 w-12 sm:h-16 sm:w-16 text-indigo-400" />
        </div>
      </div>
      
      <h3 className="mt-4 sm:mt-6 text-lg sm:text-xl font-bold text-white text-center">
        {title}
      </h3>
      
      <p className="mt-2 text-center text-sm sm:text-base text-gray-400 max-w-md px-4">
        {description}
      </p>
      
      {actionLabel && onAction && (
        <div className="mt-4 sm:mt-6">
          <Button onClick={onAction} variant="primary" size="md">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
