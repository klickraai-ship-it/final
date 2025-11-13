import React, { useState, useEffect } from 'react';
import { Save, Key, AlertCircle, CheckCircle, Shield, Mail } from 'lucide-react';

interface EmailProviderConfig {
  provider: 'ses' | null;
  isActive: boolean;
  config: {
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
  };
}

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [currentProvider, setCurrentProvider] = useState<EmailProviderConfig | null>(null);
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [isActive, setIsActive] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchEmailProvider();
  }, []);

  const fetchEmailProvider = async () => {
    setFetching(true);
    try {
      const response = await fetch('/api/settings/email-provider', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentProvider(data);
        
        if (data && data.config) {
          setAwsRegion(data.config.awsRegion || 'us-east-1');
          setIsActive(data.isActive ?? true);
        }
      }
    } catch (error) {
      console.error('Error fetching email provider:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSaveConfiguration = async () => {
    setLoading(true);
    setSaveStatus(null);
    
    try {
      // Build config object - only include keys if they're provided
      // This allows users to update region/active status without re-entering credentials
      const config: any = {
        awsRegion
      };
      
      // Only include keys if they're provided (required for new, optional for updates)
      if (awsAccessKeyId) {
        config.awsAccessKeyId = awsAccessKeyId;
      }
      if (awsSecretAccessKey) {
        config.awsSecretAccessKey = awsSecretAccessKey;
      }
      
      const response = await fetch('/api/settings/email-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          provider: 'ses',
          isActive,
          config
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSaveStatus({ type: 'success', message: data.message || 'Email provider configured successfully!' });
        setAwsAccessKeyId('');
        setAwsSecretAccessKey('');
        await fetchEmailProvider();
        setTimeout(() => setSaveStatus(null), 5000);
      } else {
        setSaveStatus({ type: 'error', message: data.message || 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      setSaveStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfiguration = async () => {
    if (!confirm('Are you sure you want to delete your email provider configuration? This will prevent you from sending campaigns until you reconfigure.')) {
      return;
    }
    
    setLoading(true);
    setSaveStatus(null);
    
    try {
      const response = await fetch('/api/settings/email-provider', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setSaveStatus({ type: 'success', message: 'Email provider configuration deleted successfully.' });
        setCurrentProvider(null);
        setAwsAccessKeyId('');
        setAwsSecretAccessKey('');
        setAwsRegion('us-east-1');
        setIsActive(true);
        setTimeout(() => setSaveStatus(null), 5000);
      } else {
        const data = await response.json();
        setSaveStatus({ type: 'error', message: data.message || 'Failed to delete configuration' });
      }
    } catch (error) {
      console.error('Error deleting configuration:', error);
      setSaveStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Email Integration Settings</h1>
        <p className="text-gray-400 mt-1">Configure your AWS SES credentials for sending campaigns</p>
      </div>

      {/* Current Status Banner */}
      {currentProvider ? (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex items-start">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-green-400 font-semibold">Email Provider Configured</h3>
            <p className="text-green-300 text-sm mt-1">
              AWS SES is configured and {currentProvider.isActive ? 'active' : 'inactive'}. 
              Region: <span className="font-mono">{currentProvider.config.awsRegion}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-yellow-400 font-semibold">Email Provider Not Configured</h3>
            <p className="text-yellow-300 text-sm mt-1">
              You must configure AWS SES credentials before you can send campaigns. Configure your credentials below.
            </p>
          </div>
        </div>
      )}

      {/* AWS SES Configuration Form */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <Shield className="h-5 w-5 text-brand-blue mr-2" />
          <div>
            <h2 className="text-lg font-semibold text-white">AWS SES Configuration</h2>
            <p className="text-sm text-gray-400">Only AWS SES is supported for multi-tenant email delivery</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              AWS Access Key ID {!currentProvider && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              value={awsAccessKeyId}
              onChange={(e) => setAwsAccessKeyId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue font-mono text-sm"
              placeholder={currentProvider ? "Leave blank to keep existing" : "AKIAIOSFODNN7EXAMPLE"}
            />
            <p className="text-xs text-gray-500 mt-1">
              {currentProvider 
                ? "Leave blank to keep your existing access key" 
                : "Your AWS IAM access key with SES permissions"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              AWS Secret Access Key {!currentProvider && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              value={awsSecretAccessKey}
              onChange={(e) => setAwsSecretAccessKey(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue font-mono text-sm"
              placeholder={currentProvider ? "Leave blank to keep existing" : "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"}
            />
            <p className="text-xs text-gray-500 mt-1">
              {currentProvider 
                ? "Leave blank to keep your existing secret key" 
                : "Your AWS secret key (stored securely)"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              AWS Region <span className="text-red-500">*</span>
            </label>
            <select
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              <option value="us-east-1">US East (N. Virginia) - us-east-1</option>
              <option value="us-east-2">US East (Ohio) - us-east-2</option>
              <option value="us-west-1">US West (N. California) - us-west-1</option>
              <option value="us-west-2">US West (Oregon) - us-west-2</option>
              <option value="eu-west-1">EU (Ireland) - eu-west-1</option>
              <option value="eu-west-2">EU (London) - eu-west-2</option>
              <option value="eu-central-1">EU (Frankfurt) - eu-central-1</option>
              <option value="ap-south-1">Asia Pacific (Mumbai) - ap-south-1</option>
              <option value="ap-northeast-1">Asia Pacific (Tokyo) - ap-northeast-1</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore) - ap-southeast-1</option>
              <option value="ap-southeast-2">Asia Pacific (Sydney) - ap-southeast-2</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">The AWS region where your SES is configured</p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-brand-blue bg-gray-700 border-gray-600 rounded focus:ring-brand-blue"
            />
            <label htmlFor="isActive" className="ml-2 text-sm text-gray-300">
              Enable this integration (uncheck to temporarily disable without deleting credentials)
            </label>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="flex items-start">
            <Key className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-blue-400 font-semibold text-sm">Security & Privacy</h4>
              <ul className="text-blue-300 text-xs mt-2 space-y-1">
                <li>• Your AWS credentials are stored per-user and never shared across accounts</li>
                <li>• No fallback to global credentials - true multi-tenant isolation</li>
                <li>• Credentials are encrypted at rest (production deployment required)</li>
                <li>• Only you can access your AWS SES integration</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="mt-4 bg-gray-900/50 border border-gray-600 rounded-lg p-4">
          <h4 className="text-gray-300 font-semibold text-sm mb-2">How to get AWS SES credentials:</h4>
          <ol className="text-gray-400 text-xs space-y-1 list-decimal list-inside">
            <li>Log in to your AWS Console and navigate to IAM</li>
            <li>Create a new IAM user with programmatic access</li>
            <li>Attach the <code className="bg-gray-800 px-1 py-0.5 rounded">AmazonSESFullAccess</code> policy</li>
            <li>Copy the Access Key ID and Secret Access Key</li>
            <li>Verify your sending domains/emails in AWS SES</li>
          </ol>
        </div>
      </div>

      {/* Status Messages */}
      {saveStatus && (
        <div className={`p-4 rounded-lg border ${
          saveStatus.type === 'success' 
            ? 'bg-green-900/20 border-green-700 text-green-300' 
            : 'bg-red-900/20 border-red-700 text-red-300'
        }`}>
          <div className="flex items-center">
            {saveStatus.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {saveStatus.message}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        {currentProvider && (
          <button
            onClick={handleDeleteConfiguration}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete Configuration'}
          </button>
        )}
        <button
          onClick={handleSaveConfiguration}
          disabled={loading || !awsRegion || (!currentProvider && (!awsAccessKeyId || !awsSecretAccessKey))}
          className="flex items-center px-6 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-light transition-colors disabled:opacity-50 ml-auto"
        >
          <Save className="h-5 w-5 mr-2" />
          {loading ? 'Saving...' : currentProvider ? 'Update Configuration' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
import React, { useState } from 'react';
import { Save, Mail, Shield, Bell, Database } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
    replyToEmail: '',
    notifications: true,
    trackOpens: true,
    trackClicks: true,
  });

  const handleSave = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your email delivery platform</p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <Mail className="h-6 w-6 text-brand-blue mr-3" />
          <h2 className="text-xl font-semibold text-white">SMTP Configuration</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">SMTP Host</label>
              <input
                type="text"
                value={settings.smtpHost}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">SMTP Port</label>
              <input
                type="text"
                value={settings.smtpPort}
                onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="587"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">SMTP Username</label>
            <input
              type="text"
              value={settings.smtpUser}
              onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">SMTP Password</label>
            <input
              type="password"
              value={settings.smtpPassword}
              onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <Shield className="h-6 w-6 text-brand-blue mr-3" />
          <h2 className="text-xl font-semibold text-white">Sender Information</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">From Email</label>
              <input
                type="email"
                value={settings.fromEmail}
                onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="noreply@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">From Name</label>
              <input
                type="text"
                value={settings.fromName}
                onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="My Company"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Reply-To Email</label>
            <input
              type="email"
              value={settings.replyToEmail}
              onChange={(e) => setSettings({ ...settings, replyToEmail: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="support@example.com"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <Bell className="h-6 w-6 text-brand-blue mr-3" />
          <h2 className="text-xl font-semibold text-white">Tracking & Notifications</h2>
        </div>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
              className="w-4 h-4 text-brand-blue bg-gray-700 border-gray-600 rounded focus:ring-brand-blue"
            />
            <span className="ml-2 text-sm text-gray-300">Enable email notifications</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.trackOpens}
              onChange={(e) => setSettings({ ...settings, trackOpens: e.target.checked })}
              className="w-4 h-4 text-brand-blue bg-gray-700 border-gray-600 rounded focus:ring-brand-blue"
            />
            <span className="ml-2 text-sm text-gray-300">Track email opens</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.trackClicks}
              onChange={(e) => setSettings({ ...settings, trackClicks: e.target.checked })}
              className="w-4 h-4 text-brand-blue bg-gray-700 border-gray-600 rounded focus:ring-brand-blue"
            />
            <span className="ml-2 text-sm text-gray-300">Track link clicks</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center px-6 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-light transition-colors"
        >
          <Save className="h-5 w-5 mr-2" />
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
