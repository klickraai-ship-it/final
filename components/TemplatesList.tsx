import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit, Copy, Eye, Code, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../client/src/lib/api';
import RichTextEditor from './RichTextEditor';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { TableSkeleton } from './ui/LoadingSkeleton';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string | null;
  createdAt: string;
}

const TemplatesList: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', htmlContent: '', textContent: '' });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    try {
      if (!newTemplate.name || !newTemplate.subject || !newTemplate.htmlContent) {
        toast.error('Missing required fields', {
          description: 'Please fill in Name, Subject, and HTML Content'
        });
        return;
      }

      // Ensure proper field mapping
      const templateData = {
        name: newTemplate.name.trim(),
        subject: newTemplate.subject.trim(),
        htmlContent: newTemplate.htmlContent, // Already email-safe from editor
        textContent: newTemplate.textContent || ''
      };

      const response = await api.post('/api/templates', templateData);

      if (response.ok) {
        setShowAddModal(false);
        setNewTemplate({
          name: '',
          subject: '',
          htmlContent: '',
          textContent: ''
        });
        fetchTemplates();
      }
      toast.success('Template created successfully!', {
        description: `"${newTemplate.name}" is ready to use`
      });
    } catch (error) {
      console.error('Error adding template:', error);
      toast.error('Failed to create template', {
        description: 'Please try again'
      });
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setShowEditModal(true);
  };

  const handleUpdateTemplate = async () => {
    try {
      if (!editingTemplate) return;

      if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.htmlContent) {
        toast.error('Missing required fields', {
          description: 'Please fill in Name, Subject, and HTML Content'
        });
        return;
      }

      // Ensure proper field mapping
      const templateData = {
        name: editingTemplate.name.trim(),
        subject: editingTemplate.subject.trim(),
        htmlContent: editingTemplate.htmlContent, // Already email-safe from editor
        textContent: editingTemplate.textContent || ''
      };

      const response = await api.put(`/api/templates/${editingTemplate.id}`, templateData);

      if (response.ok) {
        setShowEditModal(false);
        setEditingTemplate(null);
        fetchTemplates();
      }
      toast.success('Template updated successfully!');
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template', {
        description: 'Please try again'
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/api/templates/${id}`);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleDuplicateTemplate = async (id: string) => {
    try {
      await api.post(`/api/templates/${id}/duplicate`);
      fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  };

  const handlePreview = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setShowPreviewModal(true);
  };

  const renderPreview = () => {
    if (!previewTemplate) return '';

    return previewTemplate.htmlContent
      .replace(/\{\{firstName\}\}/g, 'John')
      .replace(/\{\{lastName\}\}/g, 'Doe')
      .replace(/\{\{email\}\}/g, 'john.doe@example.com');
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Email Templates</h1>
          <p className="text-gray-400 mt-1.5">Create and manage reusable email templates</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Template
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-gray-800/70"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="group relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 p-6 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-300"></div>
              <div className="relative flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1.5 group-hover:text-blue-300 transition-colors">{template.name}</h3>
                  <p className="text-sm text-gray-400 truncate">{template.subject}</p>
                </div>
              </div>
              <div className="relative flex flex-wrap gap-2">
                <button
                  onClick={() => handlePreview(template)}
                  className="flex-1 flex items-center justify-center px-3 min-h-[44px] bg-gray-700/50 text-gray-300 rounded-xl hover:bg-blue-600 hover:text-white transition-all duration-200 text-sm font-medium"
                >
                  <Eye className="h-4 w-4 mr-1.5" />
                  Preview
                </button>
                <button
                  onClick={() => handleEditTemplate(template)}
                  className="px-3 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-700/50 text-gray-300 rounded-xl hover:bg-purple-600 hover:text-white transition-all duration-200"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDuplicateTemplate(template.id)}
                  className="px-3 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gray-700/50 text-gray-300 rounded-xl hover:bg-green-600 hover:text-white transition-all duration-200"
                  title="Duplicate"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="px-3 min-h-[44px] min-w-[44px] flex items-center justify-center bg-red-500/10 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all duration-200"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No templates found
        </div>
      )}

      {showPreviewModal && previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">{previewTemplate.name}</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">Subject: {previewTemplate.subject}</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="bg-white rounded" dangerouslySetInnerHTML={{ __html: renderPreview() }} />
            </div>
            <div className="mt-4 p-3 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Preview with sample data:</strong> {'{'}firstName{'}'} → John, {'{'}lastName{'}'} → Doe, {'{'}email{'}'} → john.doe@example.com
              </p>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Create New Template</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="Welcome Email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subject Line *</label>
                <input
                  type="text"
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="Welcome to our platform!"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Content *</label>
                <RichTextEditor
                  content={newTemplate.htmlContent}
                  onChange={(html) => setNewTemplate({ ...newTemplate, htmlContent: html })}
                  placeholder="Start typing your email content..."
                  minHeight="400px"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Plain Text (optional)</label>
                <textarea
                  value={newTemplate.textContent}
                  onChange={(e) => setNewTemplate({ ...newTemplate, textContent: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="Plain text version..."
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
                onClick={handleAddTemplate}
                className="flex-1 px-4 min-h-[44px] bg-brand-blue text-white rounded-lg hover:bg-brand-blue-light transition-colors"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Edit Template</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="Welcome Email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subject Line *</label>
                <input
                  type="text"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="Welcome to our platform!"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Content *</label>
                <RichTextEditor
                  content={editingTemplate.htmlContent}
                  onChange={(html) => setEditingTemplate({ ...editingTemplate, htmlContent: html })}
                  placeholder="Start typing your email content..."
                  minHeight="400px"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Plain Text (optional)</label>
                <textarea
                  value={editingTemplate.textContent || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, textContent: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  placeholder="Plain text version..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTemplate(null);
                }}
                className="flex-1 px-4 min-h-[44px] bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTemplate}
                className="flex-1 px-4 min-h-[44px] bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
              >
                Update Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesList;