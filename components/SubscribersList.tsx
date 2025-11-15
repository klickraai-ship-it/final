import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit, Mail, UserX, UserCheck } from 'lucide-react';
import { api } from '../client/src/lib/api';

interface Subscriber {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  lists: string[];
  createdAt: string;
}

const SubscribersList: React.FC = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedSubscribers, setSelectedSubscribers] = useState<Set<string>>(new Set());
  const [newSubscriber, setNewSubscriber] = useState({ email: '', firstName: '', lastName: '', lists: '' });

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const data = await api.get('/api/subscribers');
      if (Array.isArray(data)) {
        setSubscribers(data);
      } else {
        console.error('Invalid response format:', data);
        setSubscribers([]);
      }
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubscriber = async () => {
    try {
      await api.post('/api/subscribers', {
        ...newSubscriber,
        lists: newSubscriber.lists.split(',').map(l => l.trim()).filter(Boolean)
      });
      setShowAddModal(false);
      setNewSubscriber({ email: '', firstName: '', lastName: '', lists: '' });
      fetchSubscribers();
    } catch (error) {
      console.error('Error adding subscriber:', error);
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subscriber?')) return;

    try {
      await api.delete(`/api/subscribers/${id}`);
      fetchSubscribers();
    } catch (error) {
      console.error('Error deleting subscriber:', error);
    }
  };

  const filteredSubscribers = subscribers.filter(sub => {
    const matchesSearch = sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = document.getElementById('csvFile') as HTMLInputElement;
    if (!input?.files?.[0]) {
      alert('Please select a CSV file');
      return;
    }

    const file = input.files[0];
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      alert('CSV file must have headers and at least one subscriber');
      return;
    }

    const subscribers = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return {
        email: values[0] || '',
        firstName: values[1] || '',
        lastName: values[2] || '',
        lists: values[3] || ''
      };
    });

    try {
      for (const sub of subscribers) {
        await api.post('/api/subscribers', {
          ...sub,
          lists: sub.lists.split(';').map(l => l.trim()).filter(Boolean)
        });
      }
      alert(`Successfully imported ${subscribers.length} subscribers`);
      setShowImportModal(false);
      fetchSubscribers();
    } catch (error) {
      console.error('Error importing subscribers:', error);
      alert('Failed to import some subscribers');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSubscribers.size === 0) {
      alert('Please select subscribers to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedSubscribers.size} subscriber(s)?`)) {
      return;
    }

    try {
      for (const id of selectedSubscribers) {
        await api.delete(`/api/subscribers/${id}`);
      }
      setSelectedSubscribers(new Set());
      fetchSubscribers();
    } catch (error) {
      console.error('Error deleting subscribers:', error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSubscribers.size === filteredSubscribers.length) {
      setSelectedSubscribers(new Set());
    } else {
      setSelectedSubscribers(new Set(filteredSubscribers.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedSubscribers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSubscribers(newSelected);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Subscribers</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your email subscriber list</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center px-4 min-h-[44px] bg-brand-blue text-white rounded-lg hover:bg-brand-blue-light transition-colors text-sm sm:text-base"
        >
          <Plus className="h-5 w-5 mr-2" />
          <span>Add Subscriber</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search subscribers..."
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
        <>
          {/* Desktop table view */}
          <div className="hidden md:block bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Lists</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredSubscribers.map((subscriber) => (
                  <tr key={subscriber.id} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{subscriber.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {subscriber.firstName || subscriber.lastName
                        ? `${subscriber.firstName || ''} ${subscriber.lastName || ''}`.trim()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        subscriber.status === 'active' ? 'bg-green-900 text-green-200' :
                        subscriber.status === 'unsubscribed' ? 'bg-yellow-900 text-yellow-200' :
                        'bg-red-900 text-red-200'
                      }`}>
                        {subscriber.status === 'active' && <UserCheck className="h-3 w-3 mr-1" />}
                        {subscriber.status === 'unsubscribed' && <UserX className="h-3 w-3 mr-1" />}
                        {subscriber.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {subscriber.lists.length > 0 ? subscriber.lists.join(', ') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteSubscriber(subscriber.id)}
                        className="text-red-400 hover:text-red-300 ml-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                        aria-label="Delete subscriber"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSubscribers.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No subscribers found
              </div>
            )}
          </div>

          {/* Mobile card view */}
          <div className="block md:hidden space-y-3">
            {filteredSubscribers.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                No subscribers found
              </div>
            ) : (
              filteredSubscribers.map((subscriber) => (
                <div key={subscriber.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <p className="text-sm font-medium text-white truncate">{subscriber.email}</p>
                      </div>
                      {(subscriber.firstName || subscriber.lastName) && (
                        <p className="text-sm text-gray-300 ml-6">
                          {`${subscriber.firstName || ''} ${subscriber.lastName || ''}`.trim()}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      subscriber.status === 'active' ? 'bg-green-900 text-green-200' :
                      subscriber.status === 'unsubscribed' ? 'bg-yellow-900 text-yellow-200' :
                      'bg-red-900 text-red-200'
                    }`}>
                      {subscriber.status === 'active' && <UserCheck className="h-3 w-3 mr-1" />}
                      {subscriber.status === 'unsubscribed' && <UserX className="h-3 w-3 mr-1" />}
                      {subscriber.status}
                    </span>
                  </div>
                  {subscriber.lists.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {subscriber.lists.map((list, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                          {list}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end pt-2 border-t border-gray-700">
                    <button
                      onClick={() => handleDeleteSubscriber(subscriber.id)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors min-h-[44px]"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Add New Subscriber</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={newSubscriber.email}
                  onChange={(e) => setNewSubscriber({ ...newSubscriber, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="subscriber@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                <input
                  type="text"
                  value={newSubscriber.firstName}
                  onChange={(e) => setNewSubscriber({ ...newSubscriber, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                <input
                  type="text"
                  value={newSubscriber.lastName}
                  onChange={(e) => setNewSubscriber({ ...newSubscriber, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Lists (comma-separated)</label>
                <input
                  type="text"
                  value={newSubscriber.lists}
                  onChange={(e) => setNewSubscriber({ ...newSubscriber, lists: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="newsletter, marketing"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 min-h-[44px] bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubscriber}
                className="flex-1 px-4 min-h-[44px] bg-brand-blue text-white rounded-lg hover:bg-brand-blue-light transition-colors"
              >
                Add Subscriber
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Assume getAuthHeaders is defined elsewhere or imported
// For example:
// import { getAuthHeaders } from './auth'; 

// Placeholder for getAuthHeaders if not provided
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default SubscribersList;