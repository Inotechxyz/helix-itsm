import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { changesApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Tooltip } from '../components/ui/Tooltip';
import {
  Plus, AlertTriangle, ChevronLeft, ChevronRight,
  Clock, CheckCircle, XCircle, Calendar, Shield, Eye, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ModuleErrorHandler } from '../hooks/useModuleGuard';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pending_approval: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  scheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  completed: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const typeColors: Record<string, string> = {
  standard: 'bg-green-100 text-green-800',
  normal: 'bg-yellow-100 text-yellow-800',
  emergency: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

export function ChangesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const { data: stats } = useQuery({
    queryKey: ['change-stats'],
    queryFn: () => changesApi.stats().then((r) => r.data),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['changes', page, search, statusFilter, typeFilter, priorityFilter],
    queryFn: () =>
      changesApi.list({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter ? [statusFilter] : undefined,
        type: typeFilter ? [typeFilter] : undefined,
        priority: priorityFilter ? [priorityFilter] : undefined,
      }).then((r) => r.data),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => changesApi.delete(id),
    onSuccess: () => {
      toast.success('Change request deleted');
      queryClient.invalidateQueries({ queryKey: ['changes'] });
      queryClient.invalidateQueries({ queryKey: ['change-stats'] });
    },
    onError: () => {
      toast.error('Failed to delete change request');
    },
  });

  return (
    <ModuleErrorHandler error={error} moduleName="Change Management">
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Change Management</h1>
          <p className="text-muted-foreground">Manage and track change requests</p>
        </div>
        <Link to="/changes/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Change Request
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg dark:bg-blue-900">
                <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg dark:bg-yellow-900">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg dark:bg-green-900">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats?.approved || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg dark:bg-red-900">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">{stats?.rejected || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg dark:bg-orange-900">
                <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats?.inProgress || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-100 rounded-lg dark:bg-teal-900">
                <Shield className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats?.completed || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search changes..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={[
                { value: '', label: 'All Status' },
                { value: 'draft', label: 'Draft' },
                { value: 'submitted', label: 'Submitted' },
                { value: 'pending_approval', label: 'Pending Approval' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
            <Select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              options={[
                { value: '', label: 'All Types' },
                { value: 'standard', label: 'Standard' },
                { value: 'normal', label: 'Normal' },
                { value: 'emergency', label: 'Emergency' },
              ]}
            />
            <Select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              options={[
                { value: '', label: 'All Priorities' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Change Requests List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading change requests...
          </CardContent>
        </Card>
      ) : data?.items?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No change requests found. Create your first change request.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.items?.map((change: any) => (
            <Card key={change.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Link
                        to={`/changes/${change.id}`}
                        className="text-lg font-semibold hover:text-primary"
                      >
                        {change.changeNumber}
                      </Link>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[change.status]}`}>
                        {change.status?.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[change.type]}`}>
                        {change.type}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[change.priority]}`}>
                        {change.priority}
                      </span>
                    </div>
                    <Link
                      to={`/changes/${change.id}`}
                      className="text-lg font-medium hover:text-primary block mb-2"
                    >
                      {change.title}
                    </Link>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {change.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        Requester: {change.requester?.firstName} {change.requester?.lastName}
                      </span>
                      <span>
                        {change._count?.affectedAssets || 0} assets affected
                      </span>
                      <span>
                        {change._count?.linkedTickets || 0} linked tickets
                      </span>
                      {change.scheduledStartDate && (
                        <span>
                          Scheduled: {format(new Date(change.scheduledStartDate), 'MMM d, yyyy HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Tooltip content="View">
                      <Link to={`/changes/${change.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </Tooltip>
                    {change.status === 'draft' && (
                      <Tooltip content="Delete">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this change request?')) {
                              deleteMutation.mutate(change.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total} results
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === data.totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </ModuleErrorHandler>
  );
}
