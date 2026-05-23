import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slaApi } from '../api/client';
import { useCurrentOrganizationId } from '../stores/organizationStore';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Tooltip } from '../components/ui/Tooltip';
import { showToast } from '../components/ui/Toast';
import { Search, Plus, ArrowRight, Clock, Edit2, Trash2 } from 'lucide-react';

const teamTypeLabels: Record<string, string> = {
  first_line: 'First Line',
  second_line: 'Second Line',
  third_line: 'Third Line',
};

const teamTypeColors: Record<string, string> = {
  first_line: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  second_line: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  third_line: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
};

export function OlaPoliciesPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState('');
  const [formModal, setFormModal] = useState<{ open: boolean; policy: any }>({ open: false, policy: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; policy: any }>({ open: false, policy: null });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fromTeamType: 'first_line',
    toTeamType: 'second_line',
    responseTimeHours: 4,
    resolutionTimeHours: 24,
  });

  const { data: policiesData, isLoading } = useQuery({
    queryKey: ['ola-policies', organizationId, isActive],
    queryFn: () =>
      slaApi.olaPolicies.list({
        isActive: isActive === '' ? undefined : isActive === 'true',
      }).then((r) => r.data),
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => slaApi.olaPolicies.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ola-policies'] });
      setFormModal({ open: false, policy: null });
      resetForm();
      showToast('OLA Policy created successfully', 'success');
    },
    onError: () => {
      showToast('Failed to create OLA Policy', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => slaApi.olaPolicies.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ola-policies'] });
      setFormModal({ open: false, policy: null });
      resetForm();
      showToast('OLA Policy updated successfully', 'success');
    },
    onError: () => {
      showToast('Failed to update OLA Policy', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => slaApi.olaPolicies.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ola-policies'] });
      setDeleteModal({ open: false, policy: null });
      showToast('OLA Policy deleted successfully', 'success');
    },
    onError: () => {
      showToast('Failed to delete OLA Policy', 'error');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      fromTeamType: 'first_line',
      toTeamType: 'second_line',
      responseTimeHours: 4,
      resolutionTimeHours: 24,
    });
  };

  const openEditModal = (policy: any) => {
    setFormData({
      name: policy.name,
      description: policy.description || '',
      fromTeamType: policy.fromTeamType,
      toTeamType: policy.toTeamType,
      responseTimeHours: policy.responseTimeHours,
      resolutionTimeHours: policy.resolutionTimeHours,
    });
    setFormModal({ open: true, policy });
  };

  const openCreateModal = () => {
    resetForm();
    setFormModal({ open: true, policy: null });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formModal.policy) {
      updateMutation.mutate({ id: formModal.policy.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredPolicies = policiesData?.items?.filter((policy: any) => {
    if (!search) return true;
    return (
      policy.name.toLowerCase().includes(search.toLowerCase()) ||
      policy.description?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OLA Policies</h1>
          <p className="text-muted-foreground">Configure Operational Level Agreements for team handoffs</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          New OLA Policy
        </Button>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full shrink-0">
              <ArrowRight className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h3 className="font-medium">About OLA Policies</h3>
              <p className="text-sm text-muted-foreground mt-1">
                OLA (Operational Level Agreement) policies define the expected service levels when
                tickets are handed off from one team to another. For example, when First Line
                support escalates a ticket to Second Line, the OLA defines how quickly Second Line
                should respond and resolve.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total OLA Policies</p>
                <p className="text-2xl font-bold">{policiesData?.total ?? 0}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Policies</p>
                <p className="text-2xl font-bold text-green-600">{policiesData?.items?.filter((p: any) => p.isActive).length ?? 0}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <Clock className="w-6 h-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Handoffs</p>
                <p className="text-2xl font-bold text-purple-600">3</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                <ArrowRight className="w-6 h-6 text-purple-600 dark:text-purple-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search policies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Policies List */}
      <Card>
        <CardHeader>
          <CardTitle>OLA Policies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredPolicies?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No OLA policies found. Create your first policy to get started.
            </div>
          ) : (
            <div className="divide-y">
              {filteredPolicies?.map((policy: any) => (
                <div
                  key={policy.id}
                  className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium">{policy.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${teamTypeColors[policy.fromTeamType]}`}>
                        {teamTypeLabels[policy.fromTeamType]}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${teamTypeColors[policy.toTeamType]}`}>
                        {teamTypeLabels[policy.toTeamType]}
                      </span>
                      {!policy.isActive && <Badge variant="destructive">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{policy.description}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Response: {policy.responseTimeHours}h</span>
                      <span>Resolution: {policy.resolutionTimeHours}h</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Tooltip content="Edit">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(policy)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteModal({ open: true, policy })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={formModal.open}
        onClose={() => { setFormModal({ open: false, policy: null }); resetForm(); }}
        title={formModal.policy ? 'Edit OLA Policy' : 'New OLA Policy'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => { setFormModal({ open: false, policy: null }); resetForm(); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (formModal.policy ? 'Update' : 'Create')}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Policy Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., First Line → Second Line Handoff"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this OLA policy..."
              className="w-full px-3 py-2 rounded-md border bg-background min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">From Team *</label>
              <select
                value={formData.fromTeamType}
                onChange={(e) => setFormData({ ...formData, fromTeamType: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-background"
                required
              >
                <option value="first_line">First Line</option>
                <option value="second_line">Second Line</option>
                <option value="third_line">Third Line</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">To Team *</label>
              <select
                value={formData.toTeamType}
                onChange={(e) => setFormData({ ...formData, toTeamType: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-background"
                required
              >
                <option value="first_line">First Line</option>
                <option value="second_line">Second Line</option>
                <option value="third_line">Third Line</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Response Time (hours) *</label>
              <Input
                type="number"
                min="1"
                value={formData.responseTimeHours}
                onChange={(e) => setFormData({ ...formData, responseTimeHours: parseInt(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Resolution Time (hours) *</label>
              <Input
                type="number"
                min="1"
                value={formData.resolutionTimeHours}
                onChange={(e) => setFormData({ ...formData, resolutionTimeHours: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, policy: null })}
        title="Delete OLA Policy"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteModal({ open: false, policy: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteModal.policy?.id)}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p>
          Are you sure you want to delete the OLA policy "{deleteModal.policy?.name}"?
        </p>
      </Modal>
    </div>
  );
}
