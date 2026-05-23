import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { organizationsApi, chatbotApi } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import {
  Plus, Edit, Trash2, Users, Building2, Palette,
  ArrowLeft, Mail, Shield, Crown, UserCog, UserPlus, X, Key, Globe,
  MailIcon, AlertTriangle, Bot, Sparkles, Settings2, CheckCircle, AlertCircle
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  maxUsers: number;
  createdAt: string;
  primaryColor?: string;
  logoUrl?: string;
  userCount?: number;
  teamCount?: number;
}

interface CreateOrganizationFormData {
  name: string;
  slug: string;
  maxUsers: number;
}

interface OrgUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  currentOrgRole?: string;
  teams?: Array<{ team: { id: string; name: string } }>;
}

interface OrgTeam {
  id: string;
  name: string;
  type: string;
  description?: string;
  isActive: boolean;
  _count?: { members: number };
}

type TabType = 'users' | 'teams' | 'branding' | 'invitations' | 'sso' | 'email' | 'license' | 'ai';

export function AdminOrganizationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [isEditBrandingModalOpen, setIsEditBrandingModalOpen] = useState(false);
  const [isEditSSOModalOpen, setIsEditSSOModalOpen] = useState(false);
  const [isEditEmailSettingsModalOpen, setIsEditEmailSettingsModalOpen] = useState(false);
  const [isEditAISettingsModalOpen, setIsEditAISettingsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: (data: Partial<Organization>) =>
      organizationsApi.update(selectedOrgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setIsEditModalOpen(false);
    },
  });

  // Fetch organizations list
  const { data: organizationsResponse } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await organizationsApi.list();
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object' && 'data' in data) return (data as any).data;
      return [];
    },
  });

  // Fetch license status for selected organization
  const { data: licenseStatus } = useQuery({
    queryKey: ['organizations', selectedOrgId, 'license'],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const response = await organizationsApi.getLicenseStatus(selectedOrgId);
      return response.data;
    },
    enabled: !!selectedOrgId,
  });

  const organizations = Array.isArray(organizationsResponse) ? organizationsResponse : [];
  const selectedOrg = organizations.find((org: Organization) => org.id === selectedOrgId);

  // Get tier from license (if available) or fallback to org tier
  const displayTier = licenseStatus?.hasLicense ? licenseStatus.tier : null;

  // Auto-select first org if none selected
  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  // Filter organizations based on search
  const filteredOrganizations = organizations.filter(
    (org: Organization) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'premium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'standard': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'starter': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getOrgRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'orgadmin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'agent': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'requester': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatOrgRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar - Organization List */}
      <div className="w-80 border-r bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="p-4 border-b bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Organizations</h2>
          <Input
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3"
          />
          <Button
            size="sm"
            className="w-full"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> New Organization
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredOrganizations.map((org: Organization) => (
            <button
              key={org.id}
              onClick={() => setSelectedOrgId(org.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left ${
                selectedOrgId === org.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''
              }`}
            >
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: org.primaryColor || '#0066CC' }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{org.name}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Users className="w-3 h-3" />
                  <span>{org.userCount || 0} users</span>
                </div>
              </div>
              <Badge className={getStatusBadgeColor(org.status)}>{org.status}</Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        {selectedOrg ? (
          <>
            {/* Header */}
            <div className="p-4 border-b bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedOrg.logoUrl ? (
                    <img src={selectedOrg.logoUrl} alt={selectedOrg.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold"
                      style={{ backgroundColor: selectedOrg.primaryColor || '#0066CC' }}
                    >
                      {selectedOrg.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedOrg.name}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedOrg.slug}</p>
                  </div>
                  <Badge className={getStatusBadgeColor(selectedOrg.status)}>{selectedOrg.status}</Badge>
                  {displayTier && (
                    <Badge className={getTierBadgeColor(displayTier)}>{displayTier}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsEditModalOpen(true)}>
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 border-b bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {[
                  { id: 'users' as TabType, label: 'Users', icon: Users, count: selectedOrg.userCount },
                  { id: 'teams' as TabType, label: 'Teams', icon: Building2, count: selectedOrg.teamCount },
                  { id: 'branding' as TabType, label: 'Branding', icon: Palette },
                  { id: 'invitations' as TabType, label: 'Invitations', icon: Mail },
                  { id: 'sso' as TabType, label: 'SSO', icon: Key },
                  { id: 'email' as TabType, label: 'Email', icon: MailIcon },
                  { id: 'license' as TabType, label: 'License', icon: AlertTriangle },
                  { id: 'ai' as TabType, label: 'AI', icon: Bot },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 flex-shrink-0" />
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'users' && (
                <OrgUsersTab organizationId={selectedOrg.id} />
              )}
              {activeTab === 'teams' && (
                <OrgTeamsTab organizationId={selectedOrg.id} onCreate={() => setIsCreateTeamModalOpen(true)} />
              )}
              {activeTab === 'branding' && (
                <OrgBrandingTab organizationId={selectedOrg.id} onEdit={() => setIsEditBrandingModalOpen(true)} />
              )}
              {activeTab === 'invitations' && (
                <OrgInvitationsTab organizationId={selectedOrg.id} />
              )}
              {activeTab === 'sso' && (
                <OrgSSOTab
                  organizationId={selectedOrg.id}
                  onEdit={() => setIsEditSSOModalOpen(true)}
                />
              )}
              {activeTab === 'email' && (
                <OrgEmailSettingsTab
                  organizationId={selectedOrg.id}
                  onEdit={() => setIsEditEmailSettingsModalOpen(true)}
                />
              )}
              {activeTab === 'license' && (
                <OrgLicenseTab organizationId={selectedOrg.id} />
              )}
              {activeTab === 'ai' && (
                <OrgAISettingsTab
                  organizationId={selectedOrg.id}
                  onEdit={() => setIsEditAISettingsModalOpen(true)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Select an organization</p>
              <p className="text-sm">Choose an organization from the list to manage its settings</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Organization Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Organization"
      >
        <CreateOrganizationForm
          onSubmit={(data: CreateOrganizationFormData) => {
            organizationsApi.create(data).then(() => {
              queryClient.invalidateQueries({ queryKey: ['organizations'] });
              setIsCreateModalOpen(false);
            });
          }}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit Organization Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Organization"
      >
        {selectedOrg && (
          <EditOrganizationForm
            organization={selectedOrg}
            onSubmit={(data) => updateOrgMutation.mutate(data)}
            onCancel={() => setIsEditModalOpen(false)}
            isLoading={updateOrgMutation.isPending}
          />
        )}
      </Modal>

      {/* Create Team Modal */}
      <Modal
        isOpen={isCreateTeamModalOpen}
        onClose={() => setIsCreateTeamModalOpen(false)}
        title="Create Team"
      >
        <CreateTeamForm
          organizationId={selectedOrgId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['organizations', selectedOrgId, 'teams'] });
            setIsCreateTeamModalOpen(false);
          }}
          onCancel={() => setIsCreateTeamModalOpen(false)}
        />
      </Modal>

      {/* Edit Branding Modal */}
      <Modal
        isOpen={isEditBrandingModalOpen}
        onClose={() => setIsEditBrandingModalOpen(false)}
        title="Edit Branding"
      >
        <EditBrandingForm
          organizationId={selectedOrgId!}
          branding={{ logoUrl: selectedOrg?.logoUrl, primaryColor: selectedOrg?.primaryColor }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['organizations', selectedOrgId, 'branding'] });
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            setIsEditBrandingModalOpen(false);
          }}
          onCancel={() => setIsEditBrandingModalOpen(false)}
        />
      </Modal>

      {/* Edit SSO Modal */}
      <Modal
        isOpen={isEditSSOModalOpen}
        onClose={() => setIsEditSSOModalOpen(false)}
        title="Azure AD SSO Configuration"
      >
        <EditSSOForm
          organizationId={selectedOrgId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['organizations', selectedOrgId, 'azure-ad'] });
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            setIsEditSSOModalOpen(false);
          }}
          onCancel={() => setIsEditSSOModalOpen(false)}
        />
      </Modal>

      {/* Edit Email Settings Modal */}
      <Modal
        isOpen={isEditEmailSettingsModalOpen}
        onClose={() => setIsEditEmailSettingsModalOpen(false)}
        title="Email Settings (SMTP/IMAP)"
      >
        <EditEmailSettingsForm
          organizationId={selectedOrgId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['organizations', selectedOrgId, 'email-settings'] });
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            setIsEditEmailSettingsModalOpen(false);
          }}
          onCancel={() => setIsEditEmailSettingsModalOpen(false)}
        />
      </Modal>

      {/* Edit AI Settings Modal */}
      <Modal
        isOpen={isEditAISettingsModalOpen}
        onClose={() => setIsEditAISettingsModalOpen(false)}
        title="AI Assistant Settings"
      >
        <EditAISettingsForm
          organizationId={selectedOrgId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['chatbot-config'] });
            setIsEditAISettingsModalOpen(false);
          }}
          onCancel={() => setIsEditAISettingsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

// ==================== Users Tab ====================
function OrgUsersTab({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['organizations', organizationId, 'users'],
    queryFn: () => organizationsApi.getUsers(organizationId).then(r => r.data),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, orgRole }: { userId: string; orgRole: string }) =>
      organizationsApi.updateUserRole(organizationId, userId, { orgRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'users'] });
      setSelectedUser(null);
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => organizationsApi.removeUser(organizationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'users'] });
    },
  });

  const filteredUsers = users.filter((user: OrgUser) =>
    user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'orgadmin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'manager': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'agent': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'requester': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" /> Invite User
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">No users found</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">System Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Org Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user: OrgUser) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200 font-medium">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {user.firstName} {user.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={getRoleBadgeColor(user.currentOrgRole || 'requester')}>
                      {formatOrgRole(user.currentOrgRole || 'requester')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        <UserCog className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Remove this user from the organization?')) {
                            removeUserMutation.mutate(user.id);
                          }
                        }}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Role Change Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Change User Role"
      >
        {selectedUser && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Change organization role for <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>
            </p>
            <div className="space-y-2">
              {[
                { role: 'orgadmin', label: 'Organization Admin', desc: 'Full access to organization settings', icon: Crown },
                { role: 'manager', label: 'Manager', desc: 'Manage teams, content, and users', icon: Shield },
                { role: 'approver', label: 'Approver', desc: 'Approve or reject service requests', icon: Shield },
                { role: 'agent', label: 'Agent', desc: 'Handle tickets and execute services', icon: UserCog },
                { role: 'requester', label: 'Requester', desc: 'Submit and track requests', icon: Users },
              ].map((item) => (
                <button
                  key={item.role}
                  onClick={() => updateRoleMutation.mutate({ userId: selectedUser.id, orgRole: item.role })}
                  disabled={updateRoleMutation.isPending}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedUser.currentOrgRole === item.role
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <item.icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{item.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite User"
      >
        <InviteUserForm
          organizationId={organizationId}
          onSuccess={() => {
            setIsInviteModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'users'] });
          }}
          onCancel={() => setIsInviteModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function InviteUserForm({ organizationId, onSuccess, onCancel }: any) {
  const [email, setEmail] = useState('');
  const [orgRole, setOrgRole] = useState('requester');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await organizationsApi.inviteUser(organizationId, { email, orgRole });
      onSuccess();
    } catch (error) {
      console.error('Failed to invite user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization Role</label>
        <select
          value={orgRole}
          onChange={(e) => setOrgRole(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
        >
          <option value="manager">Manager</option>
          <option value="approver">Approver</option>
          <option value="agent">Agent</option>
          <option value="requester">Requester</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>Send Invitation</Button>
      </div>
    </form>
  );
}

// ==================== Teams Tab ====================
function OrgTeamsTab({ organizationId, onCreate }: { organizationId: string; onCreate: () => void }) {
  const [selectedTeam, setSelectedTeam] = useState<OrgTeam | null>(null);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['organizations', organizationId, 'teams'],
    queryFn: () => organizationsApi.getTeams(organizationId).then(r => r.data),
  });

  // Fetch team members when a team is selected
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['organizations', organizationId, 'teams', selectedTeam?.id, 'members'],
    queryFn: () => selectedTeam ? organizationsApi.getTeamMembers(organizationId, selectedTeam.id).then(r => r.data) : Promise.resolve([]),
    enabled: !!selectedTeam,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Teams</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage teams within this organization</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="w-4 h-4 mr-1" /> Create Team
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">No teams found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team: OrgTeam) => (
            <div key={team.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{team.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{team.type.replace('_', ' ')}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {team._count?.members || 0} members
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTeam(team)}>
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Details Modal */}
      <Modal
        isOpen={!!selectedTeam}
        onClose={() => setSelectedTeam(null)}
        title={`Team: ${selectedTeam?.name || ''}`}
      >
        {selectedTeam && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">{selectedTeam.type.replace('_', ' ')}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <Badge className={selectedTeam.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}>
                  {selectedTeam.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            {selectedTeam.description && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedTeam.description}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Members ({teamMembers.length})</label>
              {teamMembers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No members in this team</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {teamMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-900">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200 text-xs font-medium">
                        {member.firstName?.charAt(0) || ''}{member.lastName?.charAt(0) || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.isPrimary && (
                          <Badge variant="outline" className="text-xs">Primary</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">Member</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==================== Branding Tab ====================
function OrgBrandingTab({ organizationId, onEdit }: { organizationId: string; onEdit: () => void }) {
  const { data: branding } = useQuery({
    queryKey: ['organizations', organizationId, 'branding'],
    queryFn: () => organizationsApi.getBranding(organizationId).then(r => r.data),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Branding Settings</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Customize the look and feel for this organization</p>
        </div>
        <Button variant="secondary" onClick={onEdit}>
          <Palette className="w-4 h-4 mr-1" /> Edit Branding
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Logo</label>
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="w-24 h-24 rounded-lg object-contain border" />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Primary Color</label>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-600"
                style={{ backgroundColor: branding?.primaryColor || '#0066CC' }}
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">{branding?.primaryColor || '#0066CC'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Invitations Tab ====================
function OrgInvitationsTab({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['organizations', organizationId, 'invitations'],
    queryFn: () => organizationsApi.getInvitations(organizationId).then(r => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (invitationId: string) => organizationsApi.cancelInvitation(organizationId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'invitations'] });
    },
    onError: (error: any) => {
      alert(error?.response?.data?.message || 'Failed to cancel invitation');
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Pending Invitations</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Users who have been invited but haven't accepted</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading invitations...</div>
      ) : invitations.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">No pending invitations</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invited</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expires</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {invitations.map((invitation: any) => (
                <tr key={invitation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{invitation.email}</td>
                  <td className="px-4 py-3">
                    <Badge>{invitation.orgRole}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(invitation.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {invitation.status === 'pending' && new Date(invitation.expiresAt) > new Date() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Cancel invitation for ${invitation.email}?`)) {
                            cancelMutation.mutate(invitation.id);
                          }
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {invitation.status !== 'pending' ? invitation.status : 'expired'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== Helper Functions ====================
function formatOrgRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

// ==================== Create Organization Form ====================
interface CreateOrganizationFormProps {
  onSubmit: (data: CreateOrganizationFormData) => void;
  onCancel: () => void;
}

function CreateOrganizationForm({ onSubmit, onCancel }: CreateOrganizationFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    maxUsers: 50,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Acme Corporation"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
        <Input
          value={formData.slug}
          onChange={(e) => setFormData({
            ...formData,
            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
          })}
          placeholder="acme-corp"
          required
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Create</Button>
      </div>
    </form>
  );
}

// ==================== Edit Organization Modal ====================
interface EditOrganizationFormProps {
  organization: Organization;
  onSubmit: (data: Partial<Organization>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function EditOrganizationForm({ organization, onSubmit, onCancel, isLoading }: EditOrganizationFormProps) {
  const [formData, setFormData] = useState({
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    maxUsers: organization.maxUsers,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
        <Input
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Users</label>
        <Input
          type="number"
          value={formData.maxUsers}
          onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 0 })}
          min={1}
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>Save Changes</Button>
      </div>
    </form>
  );
}

// ==================== Create Team Modal ====================
interface CreateTeamFormProps {
  organizationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function CreateTeamForm({ organizationId, onSuccess, onCancel }: CreateTeamFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'support',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await organizationsApi.createTeam(organizationId, formData);
      onSuccess();
    } catch (error) {
      console.error('Failed to create team:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Name</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Support Team"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
        >
          <option value="support">Support</option>
          <option value="technical">Technical</option>
          <option value="billing">Billing</option>
          <option value="general">General</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional team description"
          rows={3}
          className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>Create Team</Button>
      </div>
    </form>
  );
}

// ==================== Edit Branding Modal ====================
interface EditBrandingFormProps {
  organizationId: string;
  branding: { logoUrl?: string; primaryColor?: string };
  onSuccess: () => void;
  onCancel: () => void;
}

function EditBrandingForm({ organizationId, branding, onSuccess, onCancel }: EditBrandingFormProps) {
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor || '#0066CC');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await organizationsApi.updateBranding(organizationId, { logoUrl, primaryColor });
      onSuccess();
    } catch (error) {
      console.error('Failed to update branding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
        <Input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-12 h-10 rounded cursor-pointer"
          />
          <Input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#0066CC"
            className="flex-1"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>Save Changes</Button>
      </div>
    </form>
  );
}

// ==================== SSO Tab ====================
interface AzureAdConfig {
  azureAdEnabled: boolean;
  azureAdClientId?: string;
  azureAdTenantId?: string;
  azureAdRedirectUri?: string;
  hasClientSecret: boolean;
}

interface OrgSSOTabProps {
  organizationId: string;
  onEdit: () => void;
}

function OrgSSOTab({ organizationId, onEdit }: OrgSSOTabProps) {
  const { data: config, isLoading } = useQuery<AzureAdConfig>({
    queryKey: ['organizations', organizationId, 'azure-ad'],
    queryFn: () => organizationsApi.getAzureAdConfig(organizationId).then(r => r.data),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Azure AD SSO</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure Azure Active Directory single sign-on for this organization
          </p>
        </div>
        <Button variant="secondary" onClick={onEdit}>
          <Edit className="w-4 h-4 mr-1" /> Configure
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading SSO configuration...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
              <Badge className={config?.azureAdEnabled
                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }>
                {config?.azureAdEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Client ID</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {config?.azureAdClientId ? `${config.azureAdClientId.substring(0, 8)}...` : 'Not configured'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tenant ID</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {config?.azureAdTenantId ? `${config.azureAdTenantId.substring(0, 8)}...` : 'Not configured'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Redirect URI</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono max-w-xs truncate">
                {config?.azureAdRedirectUri || 'Not configured'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Client Secret</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {config?.hasClientSecret ? 'Configured' : 'Not configured'}
              </span>
            </div>
          </div>

          {!config?.azureAdEnabled && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex gap-3">
                <Globe className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Azure AD SSO is not enabled
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Configure your Azure AD application settings to enable SSO for this organization.
                  </p>
                </div>
              </div>
            </div>
          )}

          {config?.azureAdEnabled && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex gap-3">
                <Key className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Azure AD SSO is enabled
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Users can sign in with their Azure AD credentials. The redirect URI must be registered in your Azure AD application.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Edit SSO Form ====================
interface EditSSOFormProps {
  organizationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function EditSSOForm({ organizationId, onSuccess, onCancel }: EditSSOFormProps) {
  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Load current config
  const { data: currentConfig } = useQuery<AzureAdConfig>({
    queryKey: ['organizations', organizationId, 'azure-ad'],
    queryFn: () => organizationsApi.getAzureAdConfig(organizationId).then(r => r.data),
  });

  // Update form state when data changes
  useEffect(() => {
    if (currentConfig) {
      setEnabled(currentConfig.azureAdEnabled);
      setClientId(currentConfig.azureAdClientId || '');
      setTenantId(currentConfig.azureAdTenantId || '');
      setRedirectUri(currentConfig.azureAdRedirectUri || '');
    }
  }, [currentConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data: any = {
        azureAdEnabled: enabled,
      };

      if (enabled) {
        data.azureAdClientId = clientId;
        data.azureAdTenantId = tenantId;
        data.azureAdRedirectUri = redirectUri;
        // Only send client secret if it's provided (not empty)
        if (clientSecret) {
          data.azureAdClientSecret = clientSecret;
        }
      }

      await organizationsApi.updateAzureAdConfig(organizationId, data);
      onSuccess();
    } catch (error) {
      console.error('Failed to update SSO config:', error);
      alert('Failed to update SSO configuration. Please check your inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">Enable Azure AD SSO</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Allow users to sign in with Azure AD</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {enabled && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client ID <span className="text-red-500">*</span>
            </label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Found in Azure Portal → Azure Active Directory → App registrations → your app → Overview
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Secret <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter client secret"
                required
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Found in Azure Portal → Azure Active Directory → App registrations → your app → Certificates &amp; secrets
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tenant ID <span className="text-red-500">*</span>
            </label>
            <Input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Found in Azure Portal → Azure Active Directory → Overview → Tenant ID
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Redirect URI <span className="text-red-500">*</span>
            </label>
            <Input
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder="http://localhost:3000/v1/auth/azure/callback"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Must match exactly what's registered in your Azure AD app's Redirect URIs
            </p>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" isLoading={isLoading}>Save Configuration</Button>
      </div>
    </form>
  );
}

// ==================== Email Settings Tab ====================
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
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass?: string;
    fromAddress: string;
    fromName: string;
  } | null;
  imap?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass?: string;
    inboxFolder: string;
  } | null;
}

interface OrgEmailSettingsTabProps {
  organizationId: string;
  onEdit: () => void;
}

function OrgEmailSettingsTab({ organizationId, onEdit }: OrgEmailSettingsTabProps) {
  const { data: emailSettings, isLoading } = useQuery<EmailSettings>({
    queryKey: ['organizations', organizationId, 'email-settings'],
    queryFn: () => organizationsApi.getEmailSettings(organizationId).then(r => r.data),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Email Settings</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure SMTP and IMAP settings for this organization. If not configured, global .env settings will be used.
          </p>
        </div>
        <Button variant="secondary" onClick={onEdit}>
          <Edit className="w-4 h-4 mr-1" /> Configure
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading email settings...</div>
      ) : (
        <div className="space-y-4">
          {/* Status Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${emailSettings?.isCustom ? 'bg-blue-500' : 'bg-gray-400'}`} />
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {emailSettings?.isCustom ? 'Custom Settings Configured' : 'Using Global Settings'}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {emailSettings?.isCustom
                ? 'This organization has its own custom SMTP/IMAP configuration.'
                : 'This organization is using the global email settings from the .env file. Configure custom settings above to override.'}
            </p>
          </div>

          {/* SMTP Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MailIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100">SMTP Configuration</h4>
              {emailSettings?.hasSmtp ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Configured</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Not Set</Badge>
              )}
            </div>

            {emailSettings?.hasSmtp ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Host</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">{emailSettings.smtpHost}:{emailSettings.smtpPort}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Security</span>
                  <span className="text-gray-900 dark:text-gray-100">{emailSettings.smtpSecure ? 'SSL/TLS' : 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">From Address</span>
                  <span className="text-gray-900 dark:text-gray-100">{emailSettings.smtpFromAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">From Name</span>
                  <span className="text-gray-900 dark:text-gray-100">{emailSettings.smtpFromName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Username</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">{emailSettings.smtp?.user}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Password</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">********</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">SMTP settings not configured for this organization.</p>
            )}
          </div>

          {/* IMAP Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100">IMAP Configuration</h4>
              {emailSettings?.hasImap ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Configured</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Not Set</Badge>
              )}
            </div>

            {emailSettings?.hasImap ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Host</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">{emailSettings.imapHost}:{emailSettings.imapPort}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Security</span>
                  <span className="text-gray-900 dark:text-gray-100">{emailSettings.imapSecure ? 'SSL/TLS' : 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Inbox Folder</span>
                  <span className="text-gray-900 dark:text-gray-100">{emailSettings.imapInboxFolder}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Username</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">{emailSettings.imap?.user}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Password</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono">********</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">IMAP settings not configured for this organization.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Edit Email Settings Form ====================
interface EditEmailSettingsFormProps {
  organizationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function EditEmailSettingsForm({ organizationId, onSuccess, onCancel }: EditEmailSettingsFormProps) {
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

  // Load current settings
  const { data: currentSettings } = useQuery<EmailSettings>({
    queryKey: ['organizations', organizationId, 'email-settings'],
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
        // Only include password if provided (not empty)
        if (smtpPass) {
          data.smtp.pass = smtpPass;
        }
      } else {
        data.smtp = null; // Clear SMTP settings
      }

      if (imapEnabled) {
        data.imap = {
          host: imapHost,
          port: imapPort,
          secure: imapSecure,
          user: imapUser,
          inboxFolder: imapFolder,
        };
        // Only include password if provided (not empty)
        if (imapPass) {
          data.imap.pass = imapPass;
        }
      } else {
        data.imap = null; // Clear IMAP settings
      }

      await organizationsApi.updateEmailSettings(organizationId, data);
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'email-settings'] });
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
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
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
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder={currentSettings?.hasSmtp ? 'Leave empty to keep current' : 'Enter password'}
                      required={smtpEnabled && !currentSettings?.hasSmtp}
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
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
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
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type={showImapPass ? 'text' : 'password'}
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    placeholder={currentSettings?.hasImap ? 'Leave empty to keep current' : 'Enter password'}
                    required={imapEnabled && !currentSettings?.hasImap}
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

// License Tab Component
function OrgLicenseTab({ organizationId }: { organizationId: string }) {
  const [tokenInput, setTokenInput] = useState('');
  const queryClient = useQueryClient();

  // Get license status
  const { data: licenseStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['organizations', organizationId, 'license'],
    queryFn: async () => {
      const response = await organizationsApi.getLicenseStatus(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });

  // Import license mutation
  const importMutation = useMutation({
    mutationFn: (token: string) => organizationsApi.importLicense(organizationId, token),
    onSuccess: () => {
      // Invalidate license queries for this organization
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'license'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setTokenInput('');
      alert('License imported successfully!');
    },
    onError: (error: any) => {
      console.error('[License] Import error:', error);
      alert(error.response?.data?.message || 'Failed to import license');
    },
  });

  const handleImport = () => {
    if (!tokenInput.trim()) {
      alert('Please enter a license token');
      return;
    }
    importMutation.mutate(tokenInput.trim());
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'premium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'standard': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'basic': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const MODULE_DISPLAY_NAMES: Record<string, string> = {
    tickets: 'Tickets',
    problems: 'Problems',
    changes: 'Changes',
    assets: 'Assets',
    knowledge_base: 'Knowledge Base',
    service_catalog: 'Service Catalog',
    software_licenses: 'Software Licenses',
    sla_policies: 'SLA Policies',
    ola_policies: 'OLA Policies',
    reports: 'Reports',
  };

  const TIER_DESCRIPTIONS: Record<string, string> = {
    basic: 'Essential ITSM features (tickets, service catalog)',
    standard: 'Core ITSM workflow (tickets, problems, knowledge base, service catalog)',
    premium: 'Extended operations (+ changes, assets, software licenses, reports)',
    enterprise: 'Full platform (+ SLA policies, OLA policies)',
    custom: 'Custom module selection',
  };

  if (statusLoading) {
    return <div className="flex items-center justify-center p-8"><span>Loading...</span></div>;
  }

  const hasLicense = licenseStatus?.hasLicense;
  const isExpired = licenseStatus?.isExpired;
  const isExpiringSoon = licenseStatus?.isExpiringSoon;

  return (
    <div className="space-y-6">
      {/* License Status Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">License Information</h3>
          {hasLicense && (
            <Badge className={isExpired ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}>
              {isExpired ? 'Expired' : 'Active'}
            </Badge>
          )}
        </div>

        {isExpired && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400 font-medium">License Expired</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              Your organization's license has expired. Please import a new license token to continue using the platform.
            </p>
          </div>
        )}

        {isExpiringSoon && !isExpired && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-700 dark:text-yellow-400 font-medium">
              License Expiring Soon ({licenseStatus?.daysRemaining} days remaining)
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
              Your license will expire soon. Please renew before the expiration date.
            </p>
          </div>
        )}

        {hasLicense ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tier</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 capitalize">{licenseStatus?.tier}</p>
                <Badge className={getTierBadgeColor(licenseStatus?.tier || '')}>{licenseStatus?.tier}</Badge>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {TIER_DESCRIPTIONS[licenseStatus?.tier || 'basic'] || 'License tier'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Expires</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
                {licenseStatus?.expiresAt ? new Date(licenseStatus.expiresAt).toLocaleDateString() : 'N/A'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {licenseStatus?.daysRemaining} days remaining
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No license configured</p>
            <p className="text-sm mt-1">Import a license token below to activate your organization</p>
          </div>
        )}
      </div>

      {/* Enabled Modules Card */}
      {hasLicense && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Enabled Modules</h3>
          <div className="flex flex-wrap gap-2">
            {licenseStatus?.modules.map((module: string) => (
              <span
                key={module}
                className="px-3 py-1.5 rounded-full text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
              >
                {MODULE_DISPLAY_NAMES[module] || module}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            {licenseStatus?.modules.length} modules enabled
          </p>
        </div>
      )}

      {/* Import License Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Import License Token</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Enter the license token provided by Helix. The token will be validated and stored securely.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="font-mono text-sm"
          />
          <Button
            onClick={handleImport}
            disabled={importMutation.isPending || !tokenInput.trim()}
          >
            {importMutation.isPending ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== AI Settings Tab ====================
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
  // Embedding settings
  embeddingModel?: string;
  embeddingBaseUrl?: string;
  embeddingEnabled?: boolean;
  // Reasoning settings
  reasoningEnabled?: boolean;
}

interface OrgAISettingsTabProps {
  organizationId: string;
  onEdit: () => void;
}

function OrgAISettingsTab({ organizationId, onEdit }: OrgAISettingsTabProps) {
  const { data: config, isLoading } = useQuery<ChatbotConfig>({
    queryKey: ['chatbot-config', organizationId],
    queryFn: () => chatbotApi.getConfig().then(r => r.data),
  });

  // Get license status to check if AI is enabled
  const { data: licenseStatus } = useQuery({
    queryKey: ['organizations', organizationId, 'license'],
    queryFn: async () => {
      const response = await organizationsApi.getLicenseStatus(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><span>Loading...</span></div>;
  }

  const aiEnabled = licenseStatus?.aiEnabled;

  return (
    <div className="space-y-6">
      {/* AI Status Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {config?.chatbotName || 'Helix Assistant'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered chatbot</p>
            </div>
          </div>
          {aiEnabled ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Enabled
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              <AlertCircle className="w-3 h-3 mr-1" />
              Not Licensed
            </Badge>
          )}
        </div>

        {!aiEnabled && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              AI is not enabled in this organization's license. Generate a license with <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">--ai</code> flag and import it in the License tab.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          {aiEnabled && (
            <Button variant="secondary" onClick={onEdit}>
              <Settings2 className="w-4 h-4 mr-1" />
              Configure AI
            </Button>
          )}
        </div>
      </div>

      {aiEnabled && (
        <>
          {/* Current Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Current Configuration</h3>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">AI Model</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono text-xs break-all max-w-[200px]">
                  {config?.aiModel || 'gpt-4o-mini'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Temperature</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {config?.aiTemperature || 0.7}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Max Tokens</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {config?.aiMaxTokens || 2000}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">API Key</span>
                <span className={`text-sm font-medium ${config?.aiApiKeyConfigured ? 'text-green-600' : 'text-gray-400'}`}>
                  {config?.aiApiKeyConfigured ? 'Configured' : 'Using system default'}
                </span>
              </div>
              {config?.aiApiBaseUrl && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">API Endpoint</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono text-xs">
                    {config.aiApiBaseUrl}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Auto-Escalate</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  After {config?.autoEscalateAfter || 5} messages
                </span>
              </div>
            </div>
          </div>

          {/* Embedding & Reasoning Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mt-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Embedding & Reasoning</h3>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Semantic Search</span>
                <span className={`text-sm font-medium ${config?.embeddingEnabled !== false ? 'text-green-600' : 'text-gray-400'}`}>
                  {config?.embeddingEnabled !== false ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Embedding Model</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono text-xs">
                  {config?.embeddingModel || 'text-embedding-3-small'}
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
                <span className="text-sm text-gray-500 dark:text-gray-400">Thinking Mode</span>
                <span className={`text-sm font-medium ${config?.reasoningEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {config?.reasoningEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== Edit AI Settings Form ====================
interface EditAISettingsFormProps {
  organizationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function EditAISettingsForm({ organizationId, onSuccess, onCancel }: EditAISettingsFormProps) {
  const [chatbotName, setChatbotName] = useState('Helix Assistant');
  const [greetingMessage, setGreetingMessage] = useState('Hello! How can I help you today?');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiTemperature, setAiTemperature] = useState(0.7);
  const [aiMaxTokens, setAiMaxTokens] = useState(2000);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiApiBaseUrl, setAiApiBaseUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [autoEscalateAfter, setAutoEscalateAfter] = useState(5);
  const [escalateKeywords, setEscalateKeywords] = useState<string[]>(['human', 'agent', 'real person', 'speak to someone']);
  const [newKeyword, setNewKeyword] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Embedding settings
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState('');
  const [embeddingEnabled, setEmbeddingEnabled] = useState(true);
  // Reasoning settings
  const [reasoningEnabled, setReasoningEnabled] = useState(false);

  // Load current config
  const { data: currentConfig } = useQuery<ChatbotConfig>({
    queryKey: ['chatbot-config', organizationId],
    queryFn: () => chatbotApi.getConfig().then(r => r.data),
  });

  useEffect(() => {
    if (currentConfig) {
      setChatbotName(currentConfig.chatbotName || 'Helix Assistant');
      setGreetingMessage(currentConfig.greetingMessage || 'Hello! How can I help you today?');
      setAiModel(currentConfig.aiModel || 'gpt-4o-mini');
      setAiTemperature(currentConfig.aiTemperature || 0.7);
      setAiMaxTokens(currentConfig.aiMaxTokens || 2000);
      setAiApiBaseUrl(currentConfig.aiApiBaseUrl || '');
      setSystemPrompt(currentConfig.systemPrompt || '');
      setAutoEscalateAfter(currentConfig.autoEscalateAfter || 5);
      setEscalateKeywords(currentConfig.escalateKeywords || ['human', 'agent', 'real person', 'speak to someone']);
      // Embedding settings
      setEmbeddingModel(currentConfig.embeddingModel || 'text-embedding-3-small');
      setEmbeddingBaseUrl(currentConfig.embeddingBaseUrl || '');
      setEmbeddingEnabled(currentConfig.embeddingEnabled ?? true);
      // Reasoning settings
      setReasoningEnabled(currentConfig.reasoningEnabled ?? false);
    }
  }, [currentConfig]);

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
        // Embedding settings
        embeddingModel,
        embeddingBaseUrl: embeddingBaseUrl || undefined,
        embeddingEnabled,
        // Reasoning settings
        reasoningEnabled,
      };

      if (aiApiKey.trim()) {
        updateData.aiApiKey = aiApiKey;
      }

      await chatbotApi.updateConfig(updateData);
      onSuccess();
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
            rows={2}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
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
            LLM Model
          </label>
          <Input
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="e.g., deepseek-chat, gpt-4o-mini, claude-3-5-sonnet"
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Common models: deepseek-chat, gpt-4o-mini, gpt-4o, claude-3-5-sonnet, abab6.5s-chat
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            API Key {currentConfig?.aiApiKeyConfigured && <span className="text-green-600 text-xs">(Currently configured)</span>}
          </label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder={currentConfig?.aiApiKeyConfigured ? 'Leave empty to keep current key' : 'Enter API key'}
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
            {currentConfig?.aiApiKeyConfigured
              ? 'Enter a new key to replace the current one'
              : 'Organization\'s own API key for token tracking'}
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
            placeholder="https://api.openai.com/v1"
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
            rows={4}
            className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
            placeholder="Add custom instructions for the AI assistant..."
          />
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
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
          </label>
        </div>

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
      </div>

      {/* Reasoning Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b pb-2">
          Thinking Mode
        </h3>

        {/* Enable Thinking Mode Toggle */}
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
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
          </label>
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
