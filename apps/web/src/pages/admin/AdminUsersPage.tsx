import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, teamsApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Tooltip } from '../../components/ui/Tooltip';
import { UserPlus, Search, Edit2, Trash2, X, Check, Users } from 'lucide-react';
import { showToast } from '../../components/ui/Toast';

// System role colors (for global platform access)
const systemRoleColors: Record<string, string> = {
  superadmin: 'bg-purple-100 text-purple-800',
  user: 'bg-gray-100 text-gray-800',
};

// Org role colors (for organization-specific access)
const orgRoleColors: Record<string, string> = {
  orgadmin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  approver: 'bg-indigo-100 text-indigo-800',
  agent: 'bg-green-100 text-green-800',
  requester: 'bg-gray-100 text-gray-800',
};

// User tier colors (for SLA priority)
const tierColors: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-800',
  premium: 'bg-blue-100 text-blue-800',
  enterprise: 'bg-purple-100 text-purple-800',
  vip: 'bg-amber-100 text-amber-800',
};

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const currentOrganizationId = useCurrentOrganizationId();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',  // System role: user or superadmin
    jobTitle: '',
    department: '',
    phone: '',
    tier: 'standard',  // User tier for SLA priority
  });

  // Users filtered by current organization (org context from header)
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', currentOrganizationId],
    queryFn: () => usersApi.list().then((r) => r.data.items),
    enabled: !!currentOrganizationId,
  });

  // Transform users to include teams array (API returns teams with nested structure)
  const users = usersData?.map((user: any) => ({
    ...user,
    teams: user.teams?.map((ut: any) => ut.team) || [],
  }));

  // Teams filtered by current organization for assignment
  const { data: teams } = useQuery({
    queryKey: ['teams', currentOrganizationId],
    queryFn: () => teamsApi.list().then((r) => r.data),
    enabled: !!currentOrganizationId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showToast('User created successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to create user', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showToast('User updated successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to update user', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showToast('User deleted successfully', 'success');
    },
    onError: () => showToast('Failed to delete user', 'error'),
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      role: 'user',
      jobTitle: '',
      department: '',
      phone: '',
      tier: 'standard',
    });
    setShowModal(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      jobTitle: user.jobTitle || '',
      department: user.department || '',
      phone: user.phone || '',
      tier: user.tier || 'standard',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredUsers = users?.filter((user: any) => {
    const searchLower = search.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage system users and their roles</p>
        </div>
        <Button onClick={openCreateModal}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
        </div>
      ) : filteredUsers?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teams</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {user.firstName} {user.lastName}
                        {user.jobTitle && <span className="block text-sm text-gray-500">{user.jobTitle}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${systemRoleColors[user.role] || ''}`}>
                        {user.role === 'superadmin' ? 'Super Admin' : user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${tierColors[user.tier] || tierColors.standard}`}>
                        {user.tier ? user.tier.charAt(0).toUpperCase() + user.tier.slice(1) : 'Standard'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.teams?.slice(0, 2).map((team: any) => (
                          <Badge key={team.id} variant="outline">{team.name}</Badge>
                        ))}
                        {user.teams?.length > 2 && (
                          <Badge variant="outline">+{user.teams.length - 2}</Badge>
                        )}
                        {!user.teams?.length && <span className="text-gray-400 text-sm">None</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Tooltip content="Edit">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Delete">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this user?')) {
                                deleteMutation.mutate(user.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editingUser ? 'Edit User' : 'Create User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {editingUser ? (
            <Input
              label="Email"
              type="email"
              value={editingUser.email}
              disabled
            />
          ) : (
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!!editingUser}
              required={!editingUser}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">System Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
            >
              <option value="user">User</option>
              <option value="superadmin">Super Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              System roles control platform access. Organization roles are assigned separately.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">User Tier</label>
            <select
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
            >
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
              <option value="vip">VIP</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              User tier determines SLA priority for tickets submitted by this user.
            </p>
          </div>
          <Input
            label="Job Title"
            value={formData.jobTitle}
            onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
          />
          <Input
            label="Department"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
