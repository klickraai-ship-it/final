import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Send, Calendar, Eye, BarChart3, MousePointerClick, Mail, UserX, Monitor } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  fromName: string;
  fromEmail: string;
  lists: string[];
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
}

interface CampaignAnalytics {
  totalSubscribers: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  linkClicks: Array<{ url: string; count: number }>;
  webVersionViews?: number;
  uniqueWebVersionViewers?: number;
  recentWebVersionViews?: Array<{ subscriberId: string; viewedAt: string }>;
}

const CampaignsList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    subject: '',
    templateId: '',
    fromName: '',
    fromEmail: '',
    lists: ''
  });

  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns');
      const data = await response.json();
      
      // Handle error responses or non-array data
      if (Array.isArray(data)) {
        setCampaigns(data);
      } else {
        console.error('Invalid response format:', data);
        setCampaigns([]);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleAddCampaign = async () => {
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCampaign,
          templateId: newCampaign.templateId || null,
          lists: newCampaign.lists.split(',').map(l => l.trim()).filter(Boolean)
        })
      });
      
      if (response.ok) {
        setShowAddModal(false);
        setNewCampaign({ name: '', subject: '', templateId: '', fromName: '', fromEmail: '', lists: '' });
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error adding campaign:', error);
    }
  };

  const handleSendCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to send this campaign?')) return;
    
    try {
      const response = await fetch(`/api/campaigns/${id}/send`, { method: 'POST' });
      const result = await response.json();
      alert(result.message || 'Campaign sent successfully!');
      fetchCampaigns();
    } catch (error) {
      console.error('Error sending campaign:', error);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
    }
  };

  const handleViewAnalytics = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowAnalyticsModal(true);
    setLoadingAnalytics(true);
    
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/analytics`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusStyles: { [key: string]: string } = {
      draft: 'bg-gray-700 text-gray-300',
      scheduled: 'bg-blue-900 text-blue-200',
      sending: 'bg-yellow-900 text-yellow-200',
      sent: 'bg-green-900 text-green-200',
      failed: 'bg-red-900 text-red-200'
    };
    return statusStyles[status] || statusStyles.draft;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Create and manage email campaigns</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-light transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Campaign
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">From</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Lists</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-white">{campaign.name}</div>
                      <div className="text-xs text-gray-400">{campaign.subject}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <div>{campaign.fromName}</div>
                    <div className="text-xs text-gray-500">{campaign.fromEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {campaign.lists.length > 0 ? campaign.lists.join(', ') : 'All'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      {campaign.status === 'sent' && (
                        <button
                          onClick={() => handleViewAnalytics(campaign)}
                          className="text-brand-blue hover:text-brand-blue-light"
                          title="View analytics"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </button>
                      )}
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => handleSendCampaign(campaign.id)}
                          className="text-green-400 hover:text-green-300"
                          title="Send campaign"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCampaigns.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No campaigns found
            </div>
          )}
        </div>
      )}

      {showAnalyticsModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedCampaign.name}</h2>
                <p className="text-sm text-gray-400 mt-1">Campaign Analytics</p>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {loadingAnalytics ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <Mail className="h-8 w-8 text-blue-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{analytics.delivered}</div>
                        <div className="text-xs text-gray-400">Delivered</div>
                        <div className="text-xs text-gray-500">{analytics.sent > 0 ? ((analytics.delivered / analytics.sent) * 100).toFixed(1) : 0}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <Eye className="h-8 w-8 text-green-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{analytics.opened}</div>
                        <div className="text-xs text-gray-400">Opened</div>
                        <div className="text-xs text-gray-500">{analytics.delivered > 0 ? ((analytics.opened / analytics.delivered) * 100).toFixed(1) : 0}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <MousePointerClick className="h-8 w-8 text-purple-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{analytics.clicked}</div>
                        <div className="text-xs text-gray-400">Clicked</div>
                        <div className="text-xs text-gray-500">{analytics.delivered > 0 ? ((analytics.clicked / analytics.delivered) * 100).toFixed(1) : 0}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <UserX className="h-8 w-8 text-yellow-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{analytics.unsubscribed}</div>
                        <div className="text-xs text-gray-400">Unsubscribed</div>
                        <div className="text-xs text-gray-500">{analytics.delivered > 0 ? ((analytics.unsubscribed / analytics.delivered) * 100).toFixed(2) : 0}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <Monitor className="h-8 w-8 text-cyan-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{analytics.webVersionViews || 0}</div>
                        <div className="text-xs text-gray-400">Web Version Views</div>
                        <div className="text-xs text-gray-500">Total views</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <Eye className="h-8 w-8 text-teal-400" />
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{analytics.uniqueWebVersionViewers || 0}</div>
                        <div className="text-xs text-gray-400">Unique Viewers</div>
                        <div className="text-xs text-gray-500">{analytics.delivered > 0 ? ((analytics.uniqueWebVersionViewers || 0) / analytics.delivered * 100).toFixed(1) : 0}% of delivered</div>
                      </div>
                    </div>
                  </div>
                </div>

                {analytics.bounced > 0 && (
                  <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-6 w-6 text-red-400" />
                      <div>
                        <div className="text-sm font-semibold text-red-300">
                          {analytics.bounced} Bounced ({analytics.sent > 0 ? ((analytics.bounced / analytics.sent) * 100).toFixed(2) : 0}%)
                        </div>
                        <div className="text-xs text-red-400">Emails that could not be delivered</div>
                      </div>
                    </div>
                  </div>
                )}

                {analytics.complained > 0 && (
                  <div className="bg-orange-900 bg-opacity-20 border border-orange-700 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-6 w-6 text-orange-400" />
                      <div>
                        <div className="text-sm font-semibold text-orange-300">
                          {analytics.complained} Complaints ({analytics.delivered > 0 ? ((analytics.complained / analytics.delivered) * 100).toFixed(2) : 0}%)
                        </div>
                        <div className="text-xs text-orange-400">Recipients who marked this as spam</div>
                      </div>
                    </div>
                  </div>
                )}

                {analytics.linkClicks && analytics.linkClicks.length > 0 && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Link Clicks Breakdown</h3>
                    <div className="space-y-2">
                      {analytics.linkClicks.map((link, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700">
                          <div className="flex-1 truncate text-sm text-gray-300 mr-4">{link.url}</div>
                          <div className="text-sm font-semibold text-brand-blue">{link.count} clicks</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                No analytics data available
              </div>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Create New Campaign</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Campaign Name *</label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="Monthly Newsletter"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subject Line *</label>
                <input
                  type="text"
                  value={newCampaign.subject}
                  onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="Check out what's new this month"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Template (optional)</label>
                <select
                  value={newCampaign.templateId}
                  onChange={(e) => setNewCampaign({ ...newCampaign, templateId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  <option value="">No template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">From Name *</label>
                  <input
                    type="text"
                    value={newCampaign.fromName}
                    onChange={(e) => setNewCampaign({ ...newCampaign, fromName: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    placeholder="Your Company"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">From Email *</label>
                  <input
                    type="email"
                    value={newCampaign.fromEmail}
                    onChange={(e) => setNewCampaign({ ...newCampaign, fromEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    placeholder="hello@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Target Lists (comma-separated, leave empty for all)</label>
                <input
                  type="text"
                  value={newCampaign.lists}
                  onChange={(e) => setNewCampaign({ ...newCampaign, lists: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="newsletter, marketing"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCampaign}
                className="flex-1 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-light transition-colors"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsList;
import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit, Send, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  templateId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  createdAt: string;
}

const CampaignsList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        console.error('Failed to fetch campaigns');
        setCampaigns([]);
        return;
      }
      const data = await response.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-400" />;
      default:
        return <Edit className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-900 text-green-200';
      case 'failed':
        return 'bg-red-900 text-red-200';
      case 'scheduled':
        return 'bg-blue-900 text-blue-200';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Create and manage email campaigns</p>
        </div>
        <button
          className="flex items-center px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-light transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Campaign
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((campaign) => (
            <div key={campaign.id} className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-brand-blue transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">{campaign.name}</h3>
                  <p className="text-sm text-gray-400 truncate">{campaign.subject}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                  {getStatusIcon(campaign.status)}
                  <span className="ml-1">{campaign.status}</span>
                </span>
              </div>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Recipients: {campaign.recipientCount}</p>
                {campaign.scheduledAt && (
                  <p>Scheduled: {new Date(campaign.scheduledAt).toLocaleDateString()}</p>
                )}
                {campaign.sentAt && (
                  <p>Sent: {new Date(campaign.sentAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredCampaigns.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No campaigns found
        </div>
      )}
    </div>
  );
};

export default CampaignsList;
