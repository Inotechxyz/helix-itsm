import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi, chatbotApi } from '../api/client';
import { useCurrentOrganization, useIsOrgAdmin, useCurrentOrganizationId } from '../stores/organizationStore';
import { useLicense } from '../hooks/useLicense';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import {
  Building2, Mail, MailIcon, Edit, Palette, Key, Shield,
  AlertCircle, CheckCircle, X, Globe, Bot, MessageSquare,
  Sparkles, Settings2
} from 'lucide-react';

interface EmailSettings {
  hasSmtp: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpFromAddress?: string;
  smtpFromName?: string;
  hasImap: boolean;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapInboxFolder?: string;
  isCustom: boolean;
  // Raw settings for editing (when available)
  smtp?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    fromAddress?: string;
    fromName?: string;
  };
  imap?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    inboxFolder?: string;
  };
}

type TabType = 'overview' | 'email' | 'ai';

/**
 * Hook to check if current user is a superadmin
 */
function useIsSuperadmin() {
  const user = JSON.parse(sessionStorage.getItem('helix_session_user') || '{}');
  return user.role === 'superadmin';
}

export function OrganizationSettingsPage() {
  const organization = useCurrentOrganization();
  const organizationId = useCurrentOrganizationId();
  const isOrgAdmin = useIsOrgAdmin();
  const isSuperadmin = useIsSuperadmin();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditEmailModalOpen, setIsEditEmailModalOpen] = useState(false);

  // Get license tier from license status (not from org DB)
  const { licenseStatus } = useLicense(organizationId || '');

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No Organization Selected</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Please select an organization from the switcher to view its settings
          </p>
        </div>
      </div>
    );
  }

  if (!isOrgAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            You need Organization Admin privileges to access these settings
          </p>
        </div>
      </div>
    );
  }

  // Determine what tier to display - use license tier if available, otherwise fallback to basic
  const displayTier = licenseStatus?.hasLicense ? (licenseStatus.tier || 'basic') : 'basic';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Organization Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage settings for {organization.name}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-1" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <MailIcon className="w-4 h-4 inline mr-1" />
            Email Settings
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'ai'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Bot className="w-4 h-4 inline mr-1" />
            AI Assistant {!licenseStatus?.aiEnabled && '(Enable)'}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OrgOverviewTab organization={organization} displayTier={displayTier || 'basic'} />
      )}
      {activeTab === 'email' && (
        <OrgEmailSettingsTab
          organizationId={organization.id}
          onEdit={() => setIsEditEmailModalOpen(true)}
        />
      )}
      {activeTab === 'ai' && (
        <OrgAISettingsTab organizationId={organization.id} />
      )}

      {/* Edit Email Settings Modal */}
      <Modal
        isOpen={isEditEmailModalOpen}
        onClose={() => setIsEditEmailModalOpen(false)}
        title="Email Settings (SMTP/IMAP)"
      >
        <OrgEmailSettingsForm
          organizationId={organization.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['org-email-settings', organization.id] });
            setIsEditEmailModalOpen(false);
          }}
          onCancel={() => setIsEditEmailModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

// Overview Tab
function OrgOverviewTab({ organization, displayTier }: { organization: any; displayTier: string }) {
  // Ensure displayTier is always a string
  const tier = displayTier || 'basic';

  return (
    <div className="space-y-6">
      {/* Organization Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
          <CardDescription>Basic information about your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {organization.logoUrl ? (
              <img src={organization.logoUrl} alt={organization.name} className="w-16 h-16 rounded-lg object-contain border" />
            ) : (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: organization.primaryColor || '#0066CC' }}
              >
                {organization.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{organization.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">/{organization.slug}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</label>
              <div className="mt-1">
                <Badge className={organization.status === 'active'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                }>
                  {organization.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 capitalize">{tier}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Max Users</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{organization.maxUsers}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Primary Color</label>
              <div className="mt-1 flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border border-gray-200 dark:border-gray-600"
                  style={{ backgroundColor: organization.primaryColor || '#0066CC' }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {organization.primaryColor || '#0066CC'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-gray-500 dark:text-gray-400">
          Created on {new Date(organization.createdAt).toLocaleDateString()}
        </CardFooter>
      </Card>
    </div>
  );
}

// Email Settings Tab
function OrgEmailSettingsTab({ organizationId, onEdit }: { organizationId: string; onEdit: () => void }) {
  const { data: emailSettings, isLoading } = useQuery<EmailSettings>({
    queryKey: ['org-email-settings', organizationId],
    queryFn: () => organizationsApi.getEmailSettings(organizationId).then(r => r.data),
  });

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                Configure SMTP and IMAP settings for this organization
              </CardDescription>
            </div>
            <Button variant="secondary" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-1" /> Configure
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            {emailSettings?.isCustom ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Custom Settings Configured</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This organization uses its own email configuration
                  </p>
                </div>
              </>
            ) : (
              <>
                <Globe className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Using Global Settings</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This organization uses the default email settings from .env
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SMTP Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MailIcon className="w-5 h-5 text-gray-500" />
            <CardTitle>SMTP Configuration</CardTitle>
            {emailSettings?.hasSmtp ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 ml-auto">
                Configured
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 ml-auto">
                Not Set
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {emailSettings?.hasSmtp ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Host</span>
                <span className="text-gray-900 dark:text-gray-100 font-mono">
                  {emailSettings.smtpHost}:{emailSettings.smtpPort}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Security</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {emailSettings.smtpSecure ? 'SSL/TLS' : 'STARTTLS'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">From Address</span>
                <span className="text-gray-900 dark:text-gray-100">{emailSettings.smtpFromAddress}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">From Name</span>
                <span className="text-gray-900 dark:text-gray-100">{emailSettings.smtpFromName}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500 dark:text-gray-400">Username</span>
                <span className="text-gray-900 dark:text-gray-100 font-mono">{emailSettings.smtp?.user}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              SMTP settings not configured. Using global settings from .env
            </p>
          )}
        </CardContent>
      </Card>

      {/* IMAP Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-500" />
            <CardTitle>IMAP Configuration</CardTitle>
            {emailSettings?.hasImap ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 ml-auto">
                Configured
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 ml-auto">
                Not Set
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {emailSettings?.hasImap ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Host</span>
                <span className="text-gray-900 dark:text-gray-100 font-mono">
                  {emailSettings.imapHost}:{emailSettings.imapPort}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Security</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {emailSettings.imapSecure ? 'SSL/TLS' : 'None'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Inbox Folder</span>
                <span className="text-gray-900 dark:text-gray-100">{emailSettings.imapInboxFolder}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500 dark:text-gray-400">Username</span>
                <span className="text-gray-900 dark:text-gray-100 font-mono">{emailSettings.imap?.user}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              IMAP settings not configured. Email polling is disabled.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Email Settings Form
function OrgEmailSettingsForm({ organizationId, onSuccess, onCancel }: {
  organizationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'smtp' | 'imap'>('smtp');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // SMTP fields
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromAddress, setSmtpFromAddress] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');

  // IMAP fields
  const [imapEnabled, setImapEnabled] = useState(false);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapSecure, setImapSecure] = useState(true);
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [imapFolder, setImapFolder] = useState('INBOX');

  const [isLoading, setIsLoading] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showImapPass, setShowImapPass] = useState(false);

  // Load current settings using useEffect
  const { data: currentSettings } = useQuery<EmailSettings>({
    queryKey: ['org-email-settings', organizationId],
    queryFn: () => organizationsApi.getEmailSettings(organizationId).then(r => r.data),
  });

  // Update form state when settings are loaded
  useEffect(() => {
    if (currentSettings) {
      if (currentSettings.smtp) {
        setSmtpHost(currentSettings.smtp.host || '');
        setSmtpPort(currentSettings.smtp.port || 587);
        setSmtpSecure(currentSettings.smtp.secure ?? true);
        setSmtpUser(currentSettings.smtp.user || '');
        setSmtpFromAddress(currentSettings.smtp.fromAddress || '');
        setSmtpFromName(currentSettings.smtp.fromName || '');
        if (currentSettings.hasSmtp) setSmtpEnabled(true);
      }
      if (currentSettings.imap) {
        setImapHost(currentSettings.imap.host || '');
        setImapPort(currentSettings.imap.port || 993);
        setImapSecure(currentSettings.imap.secure ?? true);
        setImapUser(currentSettings.imap.user || '');
        setImapFolder(currentSettings.imap.inboxFolder || 'INBOX');
        if (currentSettings.hasImap) setImapEnabled(true);
      }
    }
  }, [currentSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTestResult(null);

    try {
      const data: any = {};

      if (smtpEnabled) {
        data.smtp = {
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser,
          fromAddress: smtpFromAddress,
          fromName: smtpFromName,
        };
        if (smtpPass) {
          data.smtp.pass = smtpPass;
        }
      } else {
        data.smtp = null;
      }

      if (imapEnabled) {
        data.imap = {
          host: imapHost,
          port: imapPort,
          secure: imapSecure,
          user: imapUser,
          inboxFolder: imapFolder,
        };
        if (imapPass) {
          data.imap.pass = imapPass;
        }
      } else {
        data.imap = null;
      }

      await organizationsApi.updateEmailSettings(organizationId, data);
      queryClient.invalidateQueries({ queryKey: ['org-email-settings', organizationId] });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to update email settings:', error);
      alert(error?.response?.data?.message || 'Failed to update email settings. Please check your inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const data = {
        type: 'smtp' as const,
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        pass: smtpPass,
        fromAddress: smtpFromAddress,
        fromName: smtpFromName,
      };

      const response = await organizationsApi.testEmailSettings(organizationId, data);
      setTestResult({ success: true, message: response.data?.message || 'SMTP connection successful!' });
    } catch (error: any) {
      setTestResult({ success: false, message: error?.response?.data?.message || 'SMTP connection failed. Check your settings.' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveSection('smtp')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeSection === 'smtp'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <MailIcon className="w-4 h-4 inline mr-1" />
          SMTP
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('imap')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeSection === 'imap'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Mail className="w-4 h-4 inline mr-1" />
          IMAP
        </button>
      </div>

      {/* SMTP Section */}
      {activeSection === 'smtp' && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Enable SMTP</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure custom SMTP settings</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={smtpEnabled}
                onChange={(e) => setSmtpEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {smtpEnabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SMTP Host <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.com"
                    required={smtpEnabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                    placeholder="587"
                    required={smtpEnabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Security
                  </label>
                  <select
                    value={smtpSecure ? 'true' : 'false'}
                    onChange={(e) => setSmtpSecure(e.target.value === 'true')}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  >
                    <option value="true">SSL/TLS</option>
                    <option value="false">None (STARTTLS)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="user@example.com"
                    required={smtpEnabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder={currentSettings?.hasSmtp ? 'Leave empty to keep current' : 'Enter password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSmtpPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    From Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="email"
                    value={smtpFromAddress}
                    onChange={(e) => setSmtpFromAddress(e.target.value)}
                    placeholder="noreply@example.com"
                    required={smtpEnabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    From Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="Helpdesk Support"
                    required={smtpEnabled}
                  />
                </div>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                  <p className={`text-sm ${testResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                    {testResult.message}
                  </p>
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                onClick={handleTestSmtp}
                isLoading={isTesting}
              >
                <MailIcon className="w-4 h-4 mr-1" /> Test SMTP Connection
              </Button>
            </>
          )}
        </div>
      )}

      {/* IMAP Section */}
      {activeSection === 'imap' && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Enable IMAP</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure custom IMAP settings for email polling</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={imapEnabled}
                onChange={(e) => setImapEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {imapEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  IMAP Host <span className="text-red-500">*</span>
                </label>
                <Input
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.example.com"
                  required={imapEnabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Port <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
                  placeholder="993"
                  required={imapEnabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Security
                </label>
                <select
                  value={imapSecure ? 'true' : 'false'}
                  onChange={(e) => setImapSecure(e.target.value === 'true')}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="true">SSL/TLS</option>
                  <option value="false">None</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <Input
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  placeholder="user@example.com"
                  required={imapEnabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showImapPass ? 'text' : 'password'}
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    placeholder={currentSettings?.hasImap ? 'Leave empty to keep current' : 'Enter password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowImapPass(!showImapPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showImapPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Inbox Folder
                </label>
                <Input
                  value={imapFolder}
                  onChange={(e) => setImapFolder(e.target.value)}
                  placeholder="INBOX"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>Save Settings</Button>
      </div>
    </form>
  );
}

// AI Settings Tab
interface ChatbotConfig {
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  aiApiKeyConfigured?: boolean;
  aiApiBaseUrl?: string;
  chatbotName: string;
  greetingMessage: string;
  systemPrompt?: string;
  autoEscalateAfter: number;
  escalateKeywords: string[];
  customFaqs: Array<{ question: string; answer: string }>;
  // Embedding settings
  embeddingModel?: string;
  embeddingBaseUrl?: string;
  embeddingEnabled?: boolean;
  // Reasoning settings
  reasoningEnabled?: boolean;
}

function OrgAISettingsTab({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const { licenseStatus } = useLicense(organizationId);
  const { data: config, isLoading } = useQuery<ChatbotConfig>({
    queryKey: ['chatbot-config'],
    queryFn: () => chatbotApi.getConfig().then(r => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Status Alert - Show if not enabled in license */}
      {!licenseStatus?.aiEnabled && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                AI Assistant Not Enabled
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                To enable the AI chatbot, you need to include <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">aiEnabled: true</code> in your organization's license token.
                Contact your license provider or check your license configuration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>{config?.chatbotName || 'Helix Assistant'}</CardTitle>
                <CardDescription>AI-powered chatbot for your helpdesk</CardDescription>
              </div>
            </div>
            {licenseStatus?.aiEnabled ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                <Sparkles className="w-3 h-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                <AlertCircle className="w-3 h-3 mr-1" />
                Not Licensed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {config?.greetingMessage || 'Hello! How can I help you today?'}
          </p>
          {config?.aiApiKeyConfigured && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <CheckCircle className="w-3 h-3 text-green-500" />
              Custom API key configured
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Contact your superadmin to configure AI settings
          </p>
        </CardFooter>
      </Card>

      {/* AI Configuration Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>AI model and settings in use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Model</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{config?.aiModel || 'gpt-4o-mini'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Temperature</span>
              <span className="text-gray-900 dark:text-gray-100">{config?.aiTemperature || 0.7}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Max Tokens</span>
              <span className="text-gray-900 dark:text-gray-100">{config?.aiMaxTokens || 2000}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400">API Key</span>
              <span className={`${config?.aiApiKeyConfigured ? 'text-green-600' : 'text-gray-400'}`}>
                {config?.aiApiKeyConfigured ? 'Configured' : 'Using system default'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500 dark:text-gray-400">Auto-Escalate After</span>
              <span className="text-gray-900 dark:text-gray-100">{config?.autoEscalateAfter || 5} messages</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Capabilities Card */}
      <Card>
        <CardHeader>
          <CardTitle>AI Capabilities</CardTitle>
          <CardDescription>
            Features available based on your organization's modules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Knowledge Base</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Search and share articles</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ticket Creation</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Create and track tickets</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Service Catalog</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browse and request services</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-600 dark:text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Instant Responses</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">24/7 automated support</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Embedding Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Embedding Configuration</CardTitle>
          <CardDescription>Settings for semantic search (Knowledge Base embeddings)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Semantic Search</span>
              <span className={`text-sm font-medium ${config?.embeddingEnabled !== false ? 'text-green-600' : 'text-gray-400'}`}>
                {config?.embeddingEnabled !== false ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Embedding Model</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                {config?.embeddingModel || 'text-embedding-3-small (default)'}
              </span>
            </div>
            {config?.embeddingBaseUrl && (
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Embedding Endpoint</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono text-xs">
                  {config.embeddingBaseUrl}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
              <span className={`text-sm font-medium ${config?.embeddingModel ? 'text-green-600' : 'text-gray-400'}`}>
                {config?.embeddingModel ? 'Custom configured' : 'Using default OpenAI'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Thinking Mode</span>
              <span className={`text-sm font-medium ${config?.reasoningEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                {config?.reasoningEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Contact your superadmin to configure AI settings
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

// AI Settings Form
function OrgAISettingsForm({
  initialConfig,
  onSuccess,
  onCancel
}: {
  initialConfig?: ChatbotConfig;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();

  const [chatbotName, setChatbotName] = useState(initialConfig?.chatbotName || 'Helix Assistant');
  const [greetingMessage, setGreetingMessage] = useState(
    initialConfig?.greetingMessage || 'Hello! How can I help you today?'
  );
  const [aiModel, setAiModel] = useState(initialConfig?.aiModel || 'gpt-4o-mini');
  const [aiTemperature, setAiTemperature] = useState(initialConfig?.aiTemperature || 0.7);
  const [aiMaxTokens, setAiMaxTokens] = useState(initialConfig?.aiMaxTokens || 2000);
  const [aiApiKey, setAiApiKey] = useState('');  // Empty for security, user enters new key
  const [aiApiBaseUrl, setAiApiBaseUrl] = useState(initialConfig?.aiApiBaseUrl || '');
  const [systemPrompt, setSystemPrompt] = useState(initialConfig?.systemPrompt || '');
  const [autoEscalateAfter, setAutoEscalateAfter] = useState(initialConfig?.autoEscalateAfter || 5);
  const [escalateKeywords, setEscalateKeywords] = useState<string[]>(
    initialConfig?.escalateKeywords || ['human', 'agent', 'real person', 'speak to someone']
  );
  const [newKeyword, setNewKeyword] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  // Embedding settings
  const [embeddingModel, setEmbeddingModel] = useState(initialConfig?.embeddingModel || 'text-embedding-3-small');
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState(initialConfig?.embeddingBaseUrl || '');
  const [embeddingEnabled, setEmbeddingEnabled] = useState(initialConfig?.embeddingEnabled ?? true);
  // Reasoning settings
  const [reasoningEnabled, setReasoningEnabled] = useState(initialConfig?.reasoningEnabled ?? false);

  const [isLoading, setIsLoading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) => chatbotApi.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-config'] });
      onSuccess();
    },
  });

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !escalateKeywords.includes(newKeyword.trim())) {
      setEscalateKeywords([...escalateKeywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setEscalateKeywords(escalateKeywords.filter(k => k !== keyword));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Only include API key if user entered a new one
      const updateData: any = {
        chatbotName,
        greetingMessage,
        aiModel,
        aiTemperature,
        aiMaxTokens,
        aiApiBaseUrl: aiApiBaseUrl || undefined,
        systemPrompt: systemPrompt || undefined,
        autoEscalateAfter,
        escalateKeywords,
      };

      // Include API key only if provided (user typed a new one)
      if (aiApiKey.trim()) {
        updateData.aiApiKey = aiApiKey;
      }

      // Embedding settings
      if (embeddingModel) {
        updateData.embeddingModel = embeddingModel;
      }
      if (embeddingBaseUrl.trim()) {
        updateData.embeddingBaseUrl = embeddingBaseUrl;
      }
      updateData.embeddingEnabled = embeddingEnabled;

      // Reasoning settings
      updateData.reasoningEnabled = reasoningEnabled;

      await updateMutation.mutateAsync(updateData);
    } catch (error: any) {
      console.error('Failed to update AI settings:', error);
      alert(error?.response?.data?.message || 'Failed to update AI settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b pb-2">
          Basic Settings
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Chatbot Name
          </label>
          <Input
            value={chatbotName}
            onChange={(e) => setChatbotName(e.target.value)}
            placeholder="Helix Assistant"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Greeting Message
          </label>
          <textarea
            value={greetingMessage}
            onChange={(e) => setGreetingMessage(e.target.value)}
            placeholder="Hello! How can I help you today?"
            rows={2}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      {/* AI Model Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b pb-2">
          AI Model & Credentials
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Model
          </label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
          >
            <option value="gpt-4o">GPT-4o (Most Capable)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Fast & Affordable)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
            <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
            <option value="deepseek-chat">DeepSeek Chat</option>
            <option value="abab6.5s-chat">Minimax Abab 6.5s</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            API Key {initialConfig?.aiApiKeyConfigured && <span className="text-green-600 text-xs">(Currently configured)</span>}
          </label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder={initialConfig?.aiApiKeyConfigured ? 'Leave empty to keep current key' : 'Enter API key'}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {initialConfig?.aiApiKeyConfigured
              ? 'Enter a new key to replace the current one, or leave empty to keep it'
              : 'Your own API key for tracking token usage and costs'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            API Endpoint (Optional)
          </label>
          <Input
            type="url"
            value={aiApiBaseUrl}
            onChange={(e) => setAiApiBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1 (leave empty for default)"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Custom endpoint for proxies or self-hosted models
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Temperature ({aiTemperature})
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={aiTemperature}
              onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lower = more focused, Higher = more creative
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Tokens
            </label>
            <Input
              type="number"
              value={aiMaxTokens}
              onChange={(e) => setAiMaxTokens(parseInt(e.target.value) || 2000)}
              min={100}
              max={10000}
            />
          </div>
        </div>

        {/* DeepSeek Thinking Mode Toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Thinking Mode
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              For DeepSeek models only. Enables reasoning/chain-of-thought (uses more tokens).
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={reasoningEnabled}
              onChange={(e) => setReasoningEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      {/* Escalation Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b pb-2">
          Escalation
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Auto-escalate after (messages)
          </label>
          <Input
            type="number"
            value={autoEscalateAfter}
            onChange={(e) => setAutoEscalateAfter(parseInt(e.target.value) || 5)}
            min={1}
            max={20}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Escalation Keywords
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            User messages containing these keywords will trigger escalation
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            {escalateKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="ml-1 text-gray-500 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Add keyword..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={handleAddKeyword}>
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b pb-2">
          Custom Instructions
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            System Prompt (Optional)
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Add custom instructions for the AI assistant..."
            rows={4}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            These instructions will be added to the default system prompt
          </p>
        </div>
      </div>

      {/* Embedding Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b pb-2">
          Semantic Search (Embeddings)
        </h3>

        {/* Enable Semantic Search Toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Semantic Search
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Use knowledge base embeddings for AI-powered search
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={embeddingEnabled}
              onChange={(e) => setEmbeddingEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Embedding Model
          </label>
          <select
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
          >
            <option value="text-embedding-3-small">OpenAI text-embedding-3-small (1536 dims)</option>
            <option value="text-embedding-3-large">OpenAI text-embedding-3-large (3072 dims)</option>
            <option value="deepseek-embedding-v1">DeepSeek embedding-v1 (1536 dims)</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Model used for semantic search in Knowledge Base
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Embedding API Endpoint (Optional)
          </label>
          <Input
            type="url"
            value={embeddingBaseUrl}
            onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1 (leave empty for default)"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Custom endpoint for embedding API (e.g., proxies, self-hosted models)
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          Save Settings
        </Button>
      </div>
    </form>
  );
}

// ============================================
// Embedding Settings Form (Dedicated Modal)
// ============================================
function OrgEmbeddingSettingsForm({
  initialConfig,
  onSuccess,
  onCancel
}: {
  initialConfig?: ChatbotConfig;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();

  // Embedding settings only
  const [embeddingModel, setEmbeddingModel] = useState(initialConfig?.embeddingModel || 'text-embedding-3-small');
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState(initialConfig?.embeddingBaseUrl || '');
  const [embeddingEnabled, setEmbeddingEnabled] = useState(initialConfig?.embeddingEnabled ?? true);

  const [isLoading, setIsLoading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) => chatbotApi.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-config'] });
      onSuccess();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updateData: any = {
        embeddingEnabled,
      };

      // Embedding settings
      if (embeddingModel) {
        updateData.embeddingModel = embeddingModel;
      }
      if (embeddingBaseUrl.trim()) {
        updateData.embeddingBaseUrl = embeddingBaseUrl;
      }

      await updateMutation.mutateAsync(updateData);
    } catch (error: any) {
      console.error('Failed to update embedding settings:', error);
      alert(error?.response?.data?.message || 'Failed to update embedding settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Enable Semantic Search Toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Semantic Search
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Use knowledge base embeddings for AI-powered search
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={embeddingEnabled}
            onChange={(e) => setEmbeddingEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Embedding Model */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Embedding Model
        </label>
        <Input
          type="text"
          value={embeddingModel}
          onChange={(e) => setEmbeddingModel(e.target.value)}
          placeholder="text-embedding-3-small"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Model name for semantic search (e.g., text-embedding-3-small, deepseek-embedding-v1)
        </p>
      </div>

      {/* Embedding API Endpoint */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Embedding API Endpoint (Optional)
        </label>
        <Input
          type="url"
          value={embeddingBaseUrl}
          onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Custom endpoint for embedding API (leave empty for default)
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          Save Settings
        </Button>
      </div>
    </form>
  );
}
