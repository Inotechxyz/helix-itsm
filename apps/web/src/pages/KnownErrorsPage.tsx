import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { problemsApi } from '../api/client';
import { useCurrentOrganizationId } from '../stores/organizationStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { Tooltip } from '../components/ui/Tooltip';
import { Lightbulb, AlertTriangle, Link as LinkIcon, Edit, Search, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const knownErrorStatusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  resolved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  obsolete: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export function KnownErrorsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [editingKnownError, setEditingKnownError] = useState<any>(null);
  const [knownErrorForm, setKnownErrorForm] = useState({
    errorCode: '',
    symptoms: '',
    workaround: '',
    knownSolution: '',
  });
  const organizationId = useCurrentOrganizationId();

  const { data: allKnownErrors, isLoading } = useQuery({
    queryKey: ['known-errors', organizationId, statusFilter],
    queryFn: () => problemsApi.knownErrors.list(statusFilter || undefined).then((r) => r.data),
    enabled: !!organizationId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      problemsApi.knownErrors.update(id, data),
    onSuccess: () => {
      toast.success('Known error updated');
      setEditingKnownError(null);
      queryClient.invalidateQueries({ queryKey: ['known-errors'] });
    },
    onError: () => {
      toast.error('Failed to update known error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => problemsApi.knownErrors.delete(id),
    onSuccess: () => {
      toast.success('Known error deleted');
      queryClient.invalidateQueries({ queryKey: ['known-errors'] });
    },
    onError: () => {
      toast.error('Failed to delete known error');
    },
  });

  const filteredErrors = allKnownErrors?.filter((ke: any) =>
    !search ||
    ke.errorCode?.toLowerCase().includes(search.toLowerCase()) ||
    ke.symptoms?.toLowerCase().includes(search.toLowerCase()) ||
    ke.problem?.problemNumber?.toLowerCase().includes(search.toLowerCase()) ||
    ke.problem?.title?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const activeCount = allKnownErrors?.filter((ke: any) => ke.status === 'active').length || 0;
  const resolvedCount = allKnownErrors?.filter((ke: any) => ke.status === 'resolved').length || 0;

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Known Error Database</h1>
          <p className="text-muted-foreground">Manage known errors and their linked incidents</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg dark:bg-blue-900">
                <Lightbulb className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Known Errors</p>
                <p className="text-2xl font-bold">{allKnownErrors?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg dark:bg-green-900">
                <AlertTriangle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg dark:bg-blue-900">
                <Lightbulb className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{resolvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg dark:bg-purple-900">
                <LinkIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Problems</p>
                <p className="text-2xl font-bold">
                  {new Set(allKnownErrors?.map((ke: any) => ke.problemId)).size || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by error code, symptoms, or problem..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'obsolete', label: 'Obsolete' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Known Errors List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading known errors...
          </CardContent>
        </Card>
      ) : filteredErrors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No known errors found
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredErrors.map((ke: any) => (
            <Card key={ke.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">
                      {ke.errorCode || 'No Error Code'}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${knownErrorStatusColors[ke.status]}`}>
                      {ke.status}
                    </span>
                    <Tooltip content="Edit">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingKnownError(ke);
                          setKnownErrorForm({
                            errorCode: ke.errorCode || '',
                            symptoms: ke.symptoms || '',
                            workaround: ke.workaround || '',
                            knownSolution: ke.knownSolution || '',
                          });
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this known error?')) {
                            deleteMutation.mutate(ke.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Linked Problem */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Linked Problem</span>
                    <Link
                      to={`/problems/${ke.problem?.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {ke.problem?.problemNumber}
                    </Link>
                  </div>
                  {ke.problem?.title && (
                    <p className="text-sm mt-1">{ke.problem.title}</p>
                  )}
                </div>

                {/* Symptoms */}
                {ke.symptoms && (
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Symptoms</label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{ke.symptoms}</p>
                  </div>
                )}

                {/* Workaround */}
                {ke.workaround && (
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Workaround</label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{ke.workaround}</p>
                  </div>
                )}

                {/* Known Solution */}
                {ke.knownSolution && (
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Known Solution</label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{ke.knownSolution}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>Created: {format(new Date(ke.createdAt), 'MMM d, yyyy')}</span>
                  <span>Updated: {format(new Date(ke.updatedAt), 'MMM d, yyyy')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingKnownError}
        onClose={() => { setEditingKnownError(null); setKnownErrorForm({ errorCode: '', symptoms: '', workaround: '', knownSolution: '' }); }}
        title="Edit Known Error Record"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => { setEditingKnownError(null); setKnownErrorForm({ errorCode: '', symptoms: '', workaround: '', knownSolution: '' }); }}
            >
              Cancel
            </Button>
            <Select
              value={editingKnownError?.status || 'active'}
              onChange={(e) => {
                if (editingKnownError) {
                  updateMutation.mutate({
                    id: editingKnownError.id,
                    data: { ...knownErrorForm, status: e.target.value }
                  });
                }
              }}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'obsolete', label: 'Obsolete' },
              ]}
            />
            <Button
              onClick={() => {
                if (editingKnownError) {
                  updateMutation.mutate({
                    id: editingKnownError.id,
                    data: knownErrorForm
                  });
                }
              }}
            >
              Update
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Error Code"
            value={knownErrorForm.errorCode}
            onChange={(e) => setKnownErrorForm({ ...knownErrorForm, errorCode: e.target.value })}
            placeholder="e.g., ERR-001"
          />
          <Textarea
            label="Symptoms"
            value={knownErrorForm.symptoms}
            onChange={(e) => setKnownErrorForm({ ...knownErrorForm, symptoms: e.target.value })}
            placeholder="Describe the symptoms..."
            rows={3}
          />
          <Textarea
            label="Workaround"
            value={knownErrorForm.workaround}
            onChange={(e) => setKnownErrorForm({ ...knownErrorForm, workaround: e.target.value })}
            placeholder="Temporary workaround if available..."
            rows={3}
          />
          <Textarea
            label="Known Solution"
            value={knownErrorForm.knownSolution}
            onChange={(e) => setKnownErrorForm({ ...knownErrorForm, knownSolution: e.target.value })}
            placeholder="Permanent solution..."
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
}
