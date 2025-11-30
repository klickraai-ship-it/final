
import React, { useState } from 'react';
import type { DashboardData } from '../shared/types';
import KPITile from './KPITile';
import SpamRateGauge from './SpamRateGauge';
import ComplianceChecklist from './ComplianceChecklist';
import DomainPerformanceChart from './DomainPerformanceChart';
import { CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, Download, TrendingUp, Filter } from 'lucide-react';

interface DashboardProps {
  data: DashboardData;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'delivery' | 'engagement'>('all');

  if (!data || !data.kpis) {
    return (
      <div className="text-center text-gray-400 p-8">
        No dashboard data available
      </div>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const filteredKPIs = data.kpis.filter(kpi => {
    if (selectedMetric === 'all') return true;
    if (selectedMetric === 'delivery') return kpi.title.includes('Delivery') || kpi.title.includes('Bounce');
    if (selectedMetric === 'engagement') return kpi.title.includes('Complaint') || kpi.title.includes('Unsubscribe');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-gray-800 to-gray-900 p-4 sm:p-6 rounded-xl border border-gray-700/50">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white">Performance Overview</h2>
            <p className="text-xs text-gray-400 hidden sm:block">Last updated: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 sm:gap-2 bg-gray-700/50 rounded-lg p-1">
            <button
              onClick={() => setSelectedMetric('all')}
              className={`px-2 sm:px-3 py-1.5 rounded text-xs font-medium transition-all ${
                selectedMetric === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedMetric('delivery')}
              className={`px-2 sm:px-3 py-1.5 rounded text-xs font-medium transition-all ${
                selectedMetric === 'delivery' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Delivery
            </button>
            <button
              onClick={() => setSelectedMetric('engagement')}
              className={`px-2 sm:px-3 py-1.5 rounded text-xs font-medium transition-all ${
                selectedMetric === 'engagement' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Engagement
            </button>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-xs font-medium hidden sm:inline">Refresh</span>
          </button>
          
          <button
            onClick={handleExportData}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs font-medium hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredKPIs.map((kpi) => (
          <KPITile key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-1 bg-gradient-to-br from-gray-800 to-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-700/50 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <h3 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-1">Gmail Spam Rate (Postmaster)</h3>
          <p className="text-xs sm:text-sm text-gray-400 mb-4">User-reported spam. Target: &lt;0.10%</p>
          <SpamRateGauge value={data.gmailSpamRate} />
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-gray-500">Status:</span>
            <span className={`font-medium ${
              data.gmailSpamRate < 0.10 ? 'text-green-400' :
              data.gmailSpamRate < 0.30 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {data.gmailSpamRate < 0.10 ? 'Excellent' :
               data.gmailSpamRate < 0.30 ? 'Warning' : 'Critical'}
            </span>
          </div>
        </div>
        
        <div className="xl:col-span-2 bg-gradient-to-br from-gray-800 to-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-700/50 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <h3 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-1">Performance by Domain</h3>
          <p className="text-xs sm:text-sm text-gray-400 mb-4">Key metrics across major mailbox providers.</p>
          {data.domainPerformance && data.domainPerformance.length > 0 ? (
            <DomainPerformanceChart data={data.domainPerformance} />
          ) : (
            <div className="text-center text-gray-500 py-8">No domain performance data available</div>
          )}
        </div>
      </div>

      {/* Compliance Section */}
      <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 p-4 sm:p-6 rounded-2xl border border-gray-700/50 shadow-xl hover:shadow-2xl transition-shadow duration-300 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl"></div>
        <div className="relative flex flex-col sm:flex-row items-start gap-4 mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
            <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">AI Agent: Setup Guardian</h3>
            <p className="text-xs sm:text-sm text-gray-400">Real-time audit of your sending configuration against Gmail & Yahoo requirements.</p>
          </div>
          {data.complianceChecklist && (
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {data.complianceChecklist.filter(item => item.status === 'pass').length}/{data.complianceChecklist.length}
              </div>
              <div className="text-xs text-gray-400">Checks Passed</div>
            </div>
          )}
        </div>
        <div className="relative">
          {data.complianceChecklist && data.complianceChecklist.length > 0 ? (
            <ComplianceChecklist items={data.complianceChecklist} />
          ) : (
            <div className="text-center text-gray-500 py-8">No compliance data available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
