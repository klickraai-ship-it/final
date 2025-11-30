export interface KPI {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
}

export interface ComplianceItem {
  id: string;
  title: string;
  status: 'pass' | 'warning' | 'fail';
  description: string;
}

export interface DomainPerformance {
  name: string;
  deliveryRate: number;
  complaintRate: number;
  spamRate: number;
}

export interface DashboardData {
  kpis: KPI[];
  gmailSpamRate: number;
  complianceChecklist: ComplianceItem[];
  domainPerformance: DomainPerformance[];
}
