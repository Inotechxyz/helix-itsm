import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemsApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Tooltip } from '../components/ui/Tooltip';
import {
  Plus, AlertTriangle, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle, Clock, XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ModuleErrorHandler } from '../hooks/useModuleGuard';

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  investigating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  identified: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const impactColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

export function ProblemsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const { data: stats } = useQuery({
    queryKey: ['problem-stats'],
    queryFn: () => problemsApi.getStats().then((r) => r.data),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['problems', page, search, statusFilter, priorityFilter],
    queryFn: () =>
      problemsApi.list({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter ? [statusFilter] : undefined,
        priority: priorityFilter ? [priorityFilter] : undefined,
      }).then((r) => r.data),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => problemsApi.delete(id),
    onSuccess: () => {
      toast.success('Problem deleted');
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      queryClient.invalidateQueries({ queryKey: ['problem-stats'] });
    },
    onError: () => {
      toast.error('Failed to delete problem');
    },
  });

  return (
    <ModuleErrorHandler error={error} moduleName="Problem Management">
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Problem Management</h1>
          <p className="text-muted-foreground">Identify and eliminate root causes of recurring incidents</p>
        </div>
        <Link to="/problems/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Problem
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Problems</p>
                <p className="text-3xl font-bold">{stats?.total || 0}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-3xl font-bold">{stats?.open || 0}</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-3xl font-bold">{stats?.resolved || 0}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Known Errors</p>
                <p className="text-3xl font-bold">{stats?.activeKnownErrors || 0}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search problems..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                { value: 'new', label: 'New' },
                { value: 'investigating', label: 'Investigating' },
                { value: 'identified', label: 'Identified' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
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

      {/* Problems List */}
      <Card>
        <CardHeader>
          <CardTitle>Problems</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : data?.items?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No problems found. Create your first problem to get started.
            </div>
          ) : (
            <div className="divide-y">
              {data?.items?.map((problem: any) => (
                <div
                  key={problem.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-start justify-between">
                    <Link
                      to={`/problems/${problem.id}`}
                      className="flex-1 hover:opacity-80"
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm text-muted-foreground">
                          {problem.problemNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[problem.status]}`}>
                          {problem.status?.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[problem.priority]}`}>
                          {problem.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${impactColors[problem.impact]}`}>
                          {problem.impact} impact
                        </span>
                      </div>
                      <h3 className="font-medium text-lg">{problem.title}</h3>
                      {problem.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {problem.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{problem._count?.incidents || 0} linked incidents</span>
                        <span>{problem._count?.rootCauses || 0} RCA records</span>
                        {problem.knownError && (
                          <span className="text-green-600">Has Known Error</span>
                        )}
                        <span>Created {format(new Date(problem.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </Link>
                    <Tooltip content="Delete">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          if (confirm('Are you sure you want to delete this problem?')) {
                            deleteMutation.mutate(problem.id);
                          }
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
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
        </CardContent>
      </Card>
    </div>
    </ModuleErrorHandler>
  );
}
