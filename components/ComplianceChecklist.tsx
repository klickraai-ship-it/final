import React from 'react';
import { ComplianceItem, ComplianceStatus } from '../types';
import { CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';

const statusMap: { [key in ComplianceStatus]: { icon: React.ElementType, color: string, bgColor: string } } = {
  pass: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  fail: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/10' },
  warn: { icon: AlertTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
};

interface ComplianceChecklistProps {
  items: ComplianceItem[];
}

const ComplianceChecklist: React.FC<ComplianceChecklistProps> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No compliance checks available
      </div>
    );
  }

  return (
    <div className="flow-root mt-2">
      <ul role="list" className="-mb-8">
        {items.map((item, itemIdx) => {
          // Fix: JSX requires component names to start with a capital letter.
          // The dynamic icon component is assigned to `Icon` via destructuring to satisfy this requirement.
          const { icon: Icon, color, bgColor } = statusMap[item.status];
          return (
            <li key={item.id}>
              <div className="relative pb-8">
                {itemIdx !== items.length - 1 ? (
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-600" aria-hidden="true" />
                ) : null}
                <div className="relative flex items-start space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-gray-800 ${bgColor}`}>
                      <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-200">{item.name}</p>
                      <a href={item.fixLink} className="text-xs text-brand-blue-light hover:text-brand-blue flex items-center">
                          View fix <ExternalLink className="ml-1 h-3 w-3"/>
                      </a>
                    </div>
                    <p className="text-sm text-gray-400">{item.details}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ComplianceChecklist;