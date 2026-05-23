import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { problemsApi, ticketsApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Modal } from '../components/ui/Modal';
import { Tooltip } from '../components/ui/Tooltip';
import {
  ArrowLeft, Edit, Trash2, AlertTriangle, Link as LinkIcon, FileText,
  Lightbulb, CheckCircle, Plus, Search, X, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  identified: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

export function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLinkIncident, setShowLinkIncident] = useState(false);
  const [showAddRCA, setShowAddRCA] = useState(false);
  const [showAddKnownError, setShowAddKnownError] = useState(false);
  const [editingRCA, setEditingRCA] = useState<any>(null);
  const [editingKnownError, setEditingKnownError] = useState<any>(null);

  // Link incident form
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  // RCA form
  const [rcaForm, setRcaForm] = useState({
    analysisType: 'root_cause',
    title: '',
    description: '',
    cause: '',
    impact: '',
    solution: '',
  });

  // Known Error form
  const [knownErrorForm, setKnownErrorForm] = useState({
    errorCode: '',
    symptoms: '',
    workaround: '',
    knownSolution: '',
  });

  const { data: problem, isLoading, refetch } = useQuery({
    queryKey: ['problem', id],
    queryFn: () => problemsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: ticketSearchResults } = useQuery({
    queryKey: ['tickets', 'search', ticketSearch],
    queryFn: () => ticketsApi.list({ search: ticketSearch, limit: 10, status: ['resolved'] }).then((r) => r.data.items),
    enabled: ticketSearch.length >= 2,
  });

  const deleteMutation = useMutation({
    mutationFn: () => problemsApi.delete(id!),
    onSuccess: () => {
      navigate('/problems');
    },
  });

  const linkIncidentMutation = useMutation({
    mutationFn: (data: any) => problemsApi.incidents.link(id!, data),
    onSuccess: () => {
      toast.success('Incident linked successfully');
      setShowLinkIncident(false);
      setSelectedTicket(null);
      setTicketSearch('');
      refetch();
    },
    onError: () => {
      toast.error('Failed to link incident');
    },
  });

  const unlinkIncidentMutation = useMutation({
    mutationFn: (ticketId: string) => problemsApi.incidents.unlink(id!, ticketId),
    onSuccess: () => {
      toast.success('Incident unlinked');
      refetch();
    },
  });

  const createRCAMutation = useMutation({
    mutationFn: (data: any) => problemsApi.rca.create(id!, data),
    onSuccess: () => {
      toast.success('RCA record created');
      setShowAddRCA(false);
      setRcaForm({ analysisType: 'root_cause', title: '', description: '', cause: '', impact: '', solution: '' });
      refetch();
    },
  });

  const updateRCAMutation = useMutation({
    mutationFn: ({ rcaId, data }: { rcaId: string; data: any }) =>
      problemsApi.rca.update(rcaId, data),
    onSuccess: () => {
      toast.success('RCA updated');
      setEditingRCA(null);
      refetch();
    },
  });

  const deleteRCAMutation = useMutation({
    mutationFn: (rcaId: string) => problemsApi.rca.delete(rcaId),
    onSuccess: () => {
      toast.success('RCA deleted');
      refetch();
    },
  });

  const createKnownErrorMutation = useMutation({
    mutationFn: (data: any) => problemsApi.knownErrors.create(id!, data),
    onSuccess: () => {
      toast.success('Known error record created');
      setShowAddKnownError(false);
      setKnownErrorForm({ errorCode: '', symptoms: '', workaround: '', knownSolution: '' });
      refetch();
    },
  });

  const updateKnownErrorMutation = useMutation({
    mutationFn: ({ knownErrorId, data }: { knownErrorId: string; data: any }) =>
      problemsApi.knownErrors.update(knownErrorId, data),
    onSuccess: () => {
      toast.success('Known error updated');
      refetch();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => problemsApi.update(id!, { status }),
    onSuccess: () => {
      toast.success('Status updated');
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Problem not found</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Tooltip content="Back">
            <Button variant="ghost" size="icon" onClick={() => navigate('/problems')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Tooltip>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{problem.problemNumber}</h1>
              <span className={`px-2 py-0.5 rounded text-sm font-medium ${statusColors[problem.status]}`}>
                {problem.status?.replace('_', ' ')}
              </span>
            </div>
            <p className="text-muted-foreground">{problem.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select
            value={problem.status}
            onChange={(e) => updateStatusMutation.mutate(e.target.value)}
            options={[
              { value: 'new', label: 'New' },
              { value: 'investigating', label: 'Investigating' },
              { value: 'identified', label: 'Identified' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          <Link to={`/problems/${id}/edit`}>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Info */}
          <Card>
            <CardHeader>
              <CardTitle>Problem Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Priority</label>
                  <p className={`inline-block px-2 py-1 rounded font-medium ${priorityColors[problem.priority]}`}>
                    {problem.priority}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Impact</label>
                  <p className="font-medium capitalize">{problem.impact}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Category</label>
                  <p className="font-medium">{problem.category || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Created</label>
                  <p className="font-medium">{format(new Date(problem.createdAt), 'MMM d, yyyy HH:mm')}</p>
                </div>
              </div>
              {problem.description && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm whitespace-pre-wrap">{problem.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Incidents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Linked Incidents ({problem.incidents?.length || 0})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowLinkIncident(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {problem.incidents?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No linked incidents</p>
              ) : (
                <div className="space-y-2">
                  {problem.incidents?.map((link: any) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <Link to={`/tickets/${link.ticket.id}`} className="flex-1 hover:opacity-80">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm">{link.ticket.ticketNumber}</span>
                          <span className="font-medium">{link.ticket.title}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${statusColors[link.ticket.status]}`}>
                            {link.ticket.status}
                          </span>
                        </div>
                      </Link>
                      <Tooltip content="Unlink">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unlinkIncidentMutation.mutate(link.ticket.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Root Cause Analysis */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Root Cause Analysis ({problem.rootCauses?.length || 0})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowAddRCA(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {problem.rootCauses?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No RCA records</p>
              ) : (
                <div className="space-y-4">
                  {problem.rootCauses?.map((rca: any) => (
                    <div key={rca.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600">
                            {rca.analysisType?.replace('_', ' ')}
                          </span>
                          <h4 className="font-medium">{rca.title}</h4>
                        </div>
                        <div className="flex gap-1">
                          <Tooltip content="Edit">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditingRCA(rca);
                              setRcaForm({
                                analysisType: rca.analysisType || 'root_cause',
                                title: rca.title || '',
                                description: rca.description || '',
                                cause: rca.cause || '',
                                impact: rca.impact || '',
                                solution: rca.solution || '',
                              });
                              setShowAddRCA(true);
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip content="Delete">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRCAMutation.mutate(rca.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                      {rca.description && (
                        <p className="text-sm text-muted-foreground mb-2">{rca.description}</p>
                      )}
                      {rca.cause && (
                        <div className="mb-2">
                          <span className="text-xs font-medium text-red-600">Cause: </span>
                          <span className="text-sm">{rca.cause}</span>
                        </div>
                      )}
                      {rca.solution && (
                        <div>
                          <span className="text-xs font-medium text-green-600">Solution: </span>
                          <span className="text-sm">{rca.solution}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Known Error */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Known Error Database
                </CardTitle>
                {!problem.knownError && (
                  <Button variant="outline" size="sm" onClick={() => setShowAddKnownError(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {problem.knownError ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      problem.knownError.status === 'active' ? 'bg-green-100 text-green-800' :
                      problem.knownError.status === 'obsolete' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {problem.knownError.status}
                    </span>
                    <div className="flex gap-1">
                      <Tooltip content="Edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingKnownError(problem.knownError);
                            setKnownErrorForm({
                              errorCode: problem.knownError.errorCode || '',
                              symptoms: problem.knownError.symptoms || '',
                              workaround: problem.knownError.workaround || '',
                              knownSolution: problem.knownError.knownSolution || '',
                            });
                            setShowAddKnownError(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Tooltip>
                      {problem.knownError.status !== 'resolved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateKnownErrorMutation.mutate({
                            knownErrorId: problem.knownError.id,
                            data: { status: 'resolved' }
                          })}
                        >
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  </div>
                  {problem.knownError.errorCode && (
                    <div>
                      <label className="text-sm text-muted-foreground">Error Code</label>
                      <p className="font-mono">{problem.knownError.errorCode}</p>
                    </div>
                  )}
                  {problem.knownError.symptoms && (
                    <div>
                      <label className="text-sm text-muted-foreground">Symptoms</label>
                      <p className="text-sm whitespace-pre-wrap">{problem.knownError.symptoms}</p>
                    </div>
                  )}
                  {problem.knownError.workaround && (
                    <div>
                      <label className="text-sm text-muted-foreground">Workaround</label>
                      <p className="text-sm whitespace-pre-wrap">{problem.knownError.workaround}</p>
                    </div>
                  )}
                  {problem.knownError.knownSolution && (
                    <div>
                      <label className="text-sm text-muted-foreground">Known Solution</label>
                      <p className="text-sm whitespace-pre-wrap">{problem.knownError.knownSolution}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No known error record</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Linked Incidents</span>
                  <span className="font-medium">{problem.incidents?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">RCA Records</span>
                  <span className="font-medium">{problem.rootCauses?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Known Error</span>
                  <span className={problem.knownError ? 'text-green-600' : 'text-muted-foreground'}>
                    {problem.knownError ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Created</label>
                  <p className="font-medium">{format(new Date(problem.createdAt), 'MMM d, yyyy HH:mm')}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Last Updated</label>
                  <p className="font-medium">{format(new Date(problem.updatedAt), 'MMM d, yyyy HH:mm')}</p>
                </div>
                {problem.resolvedAt && (
                  <div>
                    <label className="text-sm text-muted-foreground">Resolved</label>
                    <p className="font-medium">{format(new Date(problem.resolvedAt), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
                {problem.closedAt && (
                  <div>
                    <label className="text-sm text-muted-foreground">Closed</label>
                    <p className="font-medium">{format(new Date(problem.closedAt), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Link Incident Modal */}
      <Modal
        isOpen={showLinkIncident}
        onClose={() => { setShowLinkIncident(false); setSelectedTicket(null); setTicketSearch(''); }}
        title="Link Incident"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowLinkIncident(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedTicket}
              onClick={() => linkIncidentMutation.mutate({ ticketId: selectedTicket.id })}
            >
              Link Incident
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Search Tickets"
            placeholder="Search by ticket number or title..."
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
          />
          {ticketSearch.length >= 2 && (
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              {ticketSearchResults?.map((ticket: any) => (
                <button
                  key={ticket.id}
                  className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-b-0"
                  onClick={() => { setSelectedTicket(ticket); setTicketSearch(''); }}
                >
                  <p className="font-medium font-mono">{ticket.ticketNumber}</p>
                  <p className="text-sm text-muted-foreground">{ticket.title}</p>
                </button>
              ))}
            </div>
          )}
          {selectedTicket && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="font-medium">{selectedTicket.ticketNumber}</p>
              <p className="text-sm text-muted-foreground">{selectedTicket.title}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Add RCA Modal */}
      <Modal
        isOpen={showAddRCA}
        onClose={() => { setShowAddRCA(false); setEditingRCA(null); setRcaForm({ analysisType: 'root_cause', title: '', description: '', cause: '', impact: '', solution: '' }); }}
        title={editingRCA ? 'Edit Root Cause Analysis' : 'Add Root Cause Analysis'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowAddRCA(false); setEditingRCA(null); setRcaForm({ analysisType: 'root_cause', title: '', description: '', cause: '', impact: '', solution: '' }); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingRCA) {
                  updateRCAMutation.mutate({ rcaId: editingRCA.id, data: rcaForm });
                } else {
                  createRCAMutation.mutate(rcaForm);
                }
              }}
            >
              {editingRCA ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Analysis Type"
            value={rcaForm.analysisType}
            onChange={(e) => setRcaForm({ ...rcaForm, analysisType: e.target.value })}
            options={[
              { value: 'root_cause', label: 'Root Cause' },
              { value: 'contributing_factor', label: 'Contributing Factor' },
              { value: 'environmental', label: 'Environmental' },
            ]}
          />
          <Input
            label="Title"
            value={rcaForm.title}
            onChange={(e) => setRcaForm({ ...rcaForm, title: e.target.value })}
            placeholder="e.g., Database connection pool exhaustion"
          />
          <Textarea
            label="Description"
            value={rcaForm.description}
            onChange={(e) => setRcaForm({ ...rcaForm, description: e.target.value })}
            placeholder="Detailed analysis..."
            rows={3}
          />
          <Textarea
            label="Root Cause"
            value={rcaForm.cause}
            onChange={(e) => setRcaForm({ ...rcaForm, cause: e.target.value })}
            placeholder="What was the root cause?"
            rows={2}
          />
          <Textarea
            label="Impact"
            value={rcaForm.impact}
            onChange={(e) => setRcaForm({ ...rcaForm, impact: e.target.value })}
            placeholder="What was the impact?"
            rows={2}
          />
          <Textarea
            label="Solution"
            value={rcaForm.solution}
            onChange={(e) => setRcaForm({ ...rcaForm, solution: e.target.value })}
            placeholder="What is the permanent solution?"
            rows={2}
          />
        </div>
      </Modal>

      {/* Add Known Error Modal */}
      <Modal
        isOpen={showAddKnownError}
        onClose={() => { setShowAddKnownError(false); setEditingKnownError(null); setKnownErrorForm({ errorCode: '', symptoms: '', workaround: '', knownSolution: '' }); }}
        title={editingKnownError ? 'Edit Known Error Record' : 'Add Known Error Record'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowAddKnownError(false); setEditingKnownError(null); setKnownErrorForm({ errorCode: '', symptoms: '', workaround: '', knownSolution: '' }); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingKnownError) {
                  updateKnownErrorMutation.mutate({ knownErrorId: editingKnownError.id, data: knownErrorForm });
                } else {
                  createKnownErrorMutation.mutate(knownErrorForm);
                }
              }}
            >
              {editingKnownError ? 'Update' : 'Create'}
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
