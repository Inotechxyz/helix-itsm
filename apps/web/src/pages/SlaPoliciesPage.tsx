import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { slaApi } from '../api/client';
import { useCurrentOrganizationId } from '../stores/organizationStore';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Tooltip } from '../components/ui/Tooltip';
import { showToast } from '../components/ui/Toast';
import { Search, Plus, Clock, AlertTriangle, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

const tierColors: Record<string, string> = {
  standard: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  premium: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  enterprise: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  vip: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export function SlaPoliciesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [isActive, setIsActive] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; policy: any }>({ open: false, policy: null });

  const { data: policiesData, isLoading } = useQuery({
    queryKey: ['sla-policies', organizationId, priority, isActive],
    queryFn: () =>
      slaApi.policies.list({
        priority: priority || undefined,
        isActive: isActive === '' ? undefined : isActive === 'true',
      }).then((r) => r.data),
    enabled: !!organizationId,
  });

  const { data: statsData } = useQuery({
    queryKey: ['sla-stats', organizationId],
    queryFn: () => slaApi.getStats().then((r) => r.data),
    enabled: !!organizationId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => slaApi.policies.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
      queryClient.invalidateQueries({ queryKey: ['sla-stats'] });
      setDeleteModal({ open: false, policy: null });
      showToast('SLA Policy deleted successfully', 'success');
    },
    onError: () => {
      showToast('Failed to delete SLA Policy', 'error');
    },
  });

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
          <h1 className="text-3xl font-bold">SLA Policies</h1>
          <p className="text-muted-foreground">Configure Service Level Agreements for tickets</p>
        </div>
        <Link to="/admin/sla-policies/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New SLA Policy
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Policies</p>
                <p className="text-2xl font-bold">{statsData?.slaPolicies?.total ?? 0}</p>
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
                <p className="text-2xl font-bold text-green-600">{statsData?.slaPolicies?.active ?? 0}</p>
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
                <p className="text-sm text-muted-foreground">Tickets At Risk</p>
                <p className="text-2xl font-bold text-yellow-600">{statsData?.ticketsAtRisk ?? 0}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SLA Breached</p>
                <p className="text-2xl font-bold text-red-600">{statsData?.ticketsBreached ?? 0}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-300" />
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
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
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
          <CardTitle>SLA Policies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredPolicies?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No SLA policies found. Create your first policy to get started.
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
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[policy.priority]}`}>
                        {policy.priority}
                      </span>
                      {policy.userTier && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${tierColors[policy.userTier]}`}>
                          {policy.userTier}
                        </span>
                      )}
                      {policy.ticketType && (
                        <Badge variant="outline">{policy.ticketType}</Badge>
                      )}
                      {!policy.isActive && (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{policy.description}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Response: {policy.responseTimeHours}h</span>
                      <span>Resolution: {policy.resolutionTimeHours}h</span>
                      <span>Warning: {policy.warningThreshold}%</span>
                      {policy._count?.tickets > 0 && (
                        <span>{policy._count.tickets} tickets</span>
                      )}
                      {policy._count?.escalationRules > 0 && (
                        <span>{policy._count.escalationRules} escalation rules</span>
)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Tooltip content="Edit">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/sla-policies/${policy.id}`)}
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, policy: null })}
        title="Delete SLA Policy"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteModal({ open: false, policy: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteModal.policy?.id)}
              disabled={deleteModal.policy?._count?.tickets > 0}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p>
          Are you sure you want to delete the policy "{deleteModal.policy?.name}"?
          {deleteModal.policy?._count?.tickets > 0 && (
            <span className="text-red-600 block mt-2">
              This policy has {deleteModal.policy._count.tickets} associated tickets and cannot be deleted.
            </span>
          )}
        </p>
      </Modal>
    </div>
  );
}
