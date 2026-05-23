import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { changesApi, assetsApi, ticketsApi, problemsApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Modal } from '../components/ui/Modal';
import { Tooltip } from '../components/ui/Tooltip';
import {
  ArrowLeft, Edit, Trash2, AlertTriangle, Link as LinkIcon,
  CheckCircle, XCircle, Clock, Calendar, Plus, Search, X,
  Shield, FileText, Server, Ticket, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  scheduled: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-teal-100 text-teal-800',
  cancelled: 'bg-gray-100 text-gray-800',
  closed: 'bg-gray-100 text-gray-800',
};

const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export function ChangeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLinkAsset, setShowLinkAsset] = useState(false);
  const [showLinkTicket, setShowLinkTicket] = useState(false);
  const [showLinkProblem, setShowLinkProblem] = useState(false);
  const [showRiskAssessment, setShowRiskAssessment] = useState(false);
  const [isEditingRisk, setIsEditingRisk] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [problemSearch, setProblemSearch] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  const [riskForm, setRiskForm] = useState({
    riskLevel: 'medium',
    riskDescription: '',
    impactLevel: '',
    probability: '',
    mitigationSteps: '',
    contingencyPlan: '',
    riskOwner: '',
  });

  const { data: change, isLoading, refetch } = useQuery({
    queryKey: ['change', id],
    queryFn: () => changesApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: assetSearchResults } = useQuery({
    queryKey: ['assets', 'search', assetSearch],
    queryFn: () => assetsApi.list({ search: assetSearch, limit: 10 }).then((r) => r.data.items),
    enabled: assetSearch.length >= 2,
  });

  const { data: ticketSearchResults } = useQuery({
    queryKey: ['tickets', 'search', ticketSearch],
    queryFn: () => ticketsApi.list({ search: ticketSearch, limit: 10, status: ['resolved', 'closed'] }).then((r) => r.data.items),
    enabled: ticketSearch.length >= 2,
  });

  const { data: problemSearchResults } = useQuery({
    queryKey: ['problems', 'search', problemSearch],
    queryFn: () => problemsApi.list({ search: problemSearch, limit: 10 }).then((r) => r.data.items),
    enabled: problemSearch.length >= 2,
  });

  const deleteMutation = useMutation({
    mutationFn: () => changesApi.delete(id!),
    onSuccess: () => {
      toast.success('Change request deleted');
      navigate('/changes');
    },
    onError: () => {
      toast.error('Failed to delete change request');
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => changesApi.submit(id!),
    onSuccess: () => {
      toast.success('Change request submitted for approval');
      refetch();
    },
    onError: () => {
      toast.error('Failed to submit change request');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => changesApi.approve(id!),
    onSuccess: () => {
      toast.success('Change request approved');
      refetch();
    },
    onError: () => {
      toast.error('Failed to approve change request');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => changesApi.reject(id!, { reason: rejectReason }),
    onSuccess: () => {
      toast.success('Change request rejected');
      setShowRejectModal(false);
      setRejectReason('');
      refetch();
    },
    onError: () => {
      toast.error('Failed to reject change request');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => changesApi.update(id!, { status }),
    onSuccess: () => {
      toast.success('Status updated');
      refetch();
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const linkAssetMutation = useMutation({
    mutationFn: (data: any) => changesApi.linkAsset(id!, data),
    onSuccess: () => {
      toast.success('Asset linked');
      setShowLinkAsset(false);
      setAssetSearch('');
      setSelectedAsset(null);
      refetch();
    },
    onError: () => {
      toast.error('Failed to link asset');
    },
  });

  const unlinkAssetMutation = useMutation({
    mutationFn: (assetId: string) => changesApi.unlinkAsset(id!, assetId),
    onSuccess: () => {
      toast.success('Asset unlinked');
      refetch();
    },
    onError: () => {
      toast.error('Failed to unlink asset');
    },
  });

  const linkTicketMutation = useMutation({
    mutationFn: (data: any) => changesApi.linkTicket(id!, data),
    onSuccess: () => {
      toast.success('Ticket linked');
      setShowLinkTicket(false);
      setTicketSearch('');
      setSelectedTicket(null);
      refetch();
    },
    onError: () => {
      toast.error('Failed to link ticket');
    },
  });

  const unlinkTicketMutation = useMutation({
    mutationFn: (ticketId: string) => changesApi.unlinkTicket(id!, ticketId),
    onSuccess: () => {
      toast.success('Ticket unlinked');
      refetch();
    },
    onError: () => {
      toast.error('Failed to unlink ticket');
    },
  });

  const linkProblemMutation = useMutation({
    mutationFn: (data: any) => changesApi.linkProblem(id!, data),
    onSuccess: () => {
      toast.success('Problem linked');
      setShowLinkProblem(false);
      setProblemSearch('');
      setSelectedProblem(null);
      refetch();
    },
    onError: () => {
      toast.error('Failed to link problem');
    },
  });

  const unlinkProblemMutation = useMutation({
    mutationFn: (problemId: string) => changesApi.unlinkProblem(id!, problemId),
    onSuccess: () => {
      toast.success('Problem unlinked');
      refetch();
    },
    onError: () => {
      toast.error('Failed to unlink problem');
    },
  });

  const createRiskMutation = useMutation({
    mutationFn: (data: any) => changesApi.createRiskAssessment(id!, data),
    onSuccess: () => {
      toast.success('Risk assessment created');
      setShowRiskAssessment(false);
      setIsEditingRisk(false);
      setRiskForm({
        riskLevel: 'medium',
        riskDescription: '',
        impactLevel: '',
        probability: '',
        mitigationSteps: '',
        contingencyPlan: '',
        riskOwner: '',
      });
      refetch();
    },
    onError: () => {
      toast.error('Failed to create risk assessment');
    },
  });

  const updateRiskMutation = useMutation({
    mutationFn: (data: any) => changesApi.updateRiskAssessment(id!, data),
    onSuccess: () => {
      toast.success('Risk assessment updated');
      setShowRiskAssessment(false);
      setIsEditingRisk(false);
      setRiskForm({
        riskLevel: 'medium',
        riskDescription: '',
        impactLevel: '',
        probability: '',
        mitigationSteps: '',
        contingencyPlan: '',
        riskOwner: '',
      });
      refetch();
    },
    onError: () => {
      toast.error('Failed to update risk assessment');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!change) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Change request not found</div>
      </div>
    );
  }

  const canEdit = change.status === 'draft';
  const canSubmit = change.status === 'draft';
  const canApprove = change.status === 'submitted' || change.status === 'pending_approval';
  const canStart = change.status === 'approved' || change.status === 'scheduled';
  const canComplete = change.status === 'in_progress';

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Tooltip content="Back">
            <Button variant="ghost" size="icon" onClick={() => navigate('/changes')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Tooltip>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{change.changeNumber}</h1>
              <span className={`px-2 py-0.5 rounded text-sm font-medium ${statusColors[change.status]}`}>
                {change.status?.replace('_', ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded text-sm font-medium ${riskColors[change.risk]}`}>
                {change.risk} risk
              </span>
            </div>
            <p className="text-muted-foreground">{change.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <Button onClick={() => submitMutation.mutate()}>
              Submit for Approval
            </Button>
          )}
          {canApprove && (
            <>
              <Button variant="outline" onClick={() => setShowRejectModal(true)}>
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button onClick={() => approveMutation.mutate()}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          {canStart && (
            <Button onClick={() => updateStatusMutation.mutate('in_progress')}>
              Start Change
            </Button>
          )}
          {canComplete && (
            <Button onClick={() => updateStatusMutation.mutate('completed')}>
              Mark Complete
            </Button>
          )}
          {canEdit && (
            <>
              <Link to={`/changes/${id}/edit`}>
                <Button variant="outline">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Details */}
          <Card>
            <CardHeader>
              <CardTitle>Change Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Type</label>
                  <p className="font-medium capitalize">{change.type}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Priority</label>
                  <p className="font-medium capitalize">{change.priority}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Category</label>
                  <p className="font-medium">{change.category || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">CAB Reviewed</label>
                  <p className="font-medium">{change.cabReviewed ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {change.description && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm whitespace-pre-wrap">{change.description}</p>
                </div>
              )}
              {change.justification && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Business Justification</h4>
                  <p className="text-sm whitespace-pre-wrap">{change.justification}</p>
                </div>
              )}
              {change.implementationPlan && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Implementation Plan</h4>
                  <p className="text-sm whitespace-pre-wrap">{change.implementationPlan}</p>
                </div>
              )}
              {change.rollbackPlan && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Rollback Plan</h4>
                  <p className="text-sm whitespace-pre-wrap">{change.rollbackPlan}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Affected Assets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Affected Assets ({change.affectedAssets?.length || 0})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowLinkAsset(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {change.affectedAssets?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No linked assets</p>
              ) : (
                <div className="space-y-2">
                  {change.affectedAssets?.map((link: any) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <div>
                        <Link
                          to={`/assets/${link.asset.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {link.asset.name}
                        </Link>
                        {link.asset.assetTag && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({link.asset.assetTag})
                          </span>
                        )}
                        {link.impact && (
                          <p className="text-sm text-muted-foreground">{link.impact}</p>
                        )}
                      </div>
                      <Tooltip content="Unlink">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unlinkAssetMutation.mutate(link.asset.id)}
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

          {/* Linked Tickets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  Linked Tickets ({change.linkedTickets?.length || 0})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowLinkTicket(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {change.linkedTickets?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No linked tickets</p>
              ) : (
                <div className="space-y-2">
                  {change.linkedTickets?.map((link: any) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <Link
                        to={`/tickets/${link.ticket.id}`}
                        className="flex items-center gap-3 flex-1"
                      >
                        <span className="font-mono text-sm">{link.ticket.ticketNumber}</span>
                        <span className="font-medium">{link.ticket.title}</span>
                      </Link>
                      <Tooltip content="Unlink">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unlinkTicketMutation.mutate(link.ticket.id)}
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

          {/* Linked Problems */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Linked Problems ({change.linkedProblems?.length || 0})
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowLinkProblem(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {change.linkedProblems?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No linked problems</p>
              ) : (
                <div className="space-y-2">
                  {change.linkedProblems?.map((link: any) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <Link
                        to={`/problems/${link.problem.id}`}
                        className="flex items-center gap-3 flex-1"
                      >
                        <span className="font-mono text-sm">{link.problem.problemNumber}</span>
                        <span className="font-medium">{link.problem.title}</span>
                      </Link>
                      <Tooltip content="Unlink">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unlinkProblemMutation.mutate(link.problem.id)}
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

          {/* Risk Assessment */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Risk Assessment
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (change.riskAssessment) {
                      // Edit existing
                      setIsEditingRisk(true);
                      setRiskForm({
                        riskLevel: change.riskAssessment.riskLevel || 'medium',
                        riskDescription: change.riskAssessment.riskDescription || '',
                        impactLevel: change.riskAssessment.impactLevel || '',
                        probability: change.riskAssessment.probability || '',
                        mitigationSteps: change.riskAssessment.mitigationSteps || '',
                        contingencyPlan: change.riskAssessment.contingencyPlan || '',
                        riskOwner: change.riskAssessment.riskOwner || '',
                      });
                    }
                    setShowRiskAssessment(true);
                  }}
                >
                  {change.riskAssessment ? (
                    <>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {change.riskAssessment ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-sm font-medium ${riskColors[change.riskAssessment.riskLevel]}`}>
                      {change.riskAssessment.riskLevel} Risk
                    </span>
                  </div>
                  {change.riskAssessment.riskDescription && (
                    <div>
                      <label className="text-sm text-muted-foreground">Risk Description</label>
                      <p className="text-sm">{change.riskAssessment.riskDescription}</p>
                    </div>
                  )}
                  {change.riskAssessment.mitigationSteps && (
                    <div>
                      <label className="text-sm text-muted-foreground">Mitigation Steps</label>
                      <p className="text-sm whitespace-pre-wrap">{change.riskAssessment.mitigationSteps}</p>
                    </div>
                  )}
                  {change.riskAssessment.contingencyPlan && (
                    <div>
                      <label className="text-sm text-muted-foreground">Contingency Plan</label>
                      <p className="text-sm whitespace-pre-wrap">{change.riskAssessment.contingencyPlan}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No risk assessment</p>
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
                  <span className="text-sm text-muted-foreground">Affected Assets</span>
                  <span className="font-medium">{change.affectedAssets?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Linked Tickets</span>
                  <span className="font-medium">{change.linkedTickets?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Linked Problems</span>
                  <span className="font-medium">{change.linkedProblems?.length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Requester</label>
                <p className="font-medium">
                  {change.requester?.firstName} {change.requester?.lastName}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Assigned To</label>
                <p className="font-medium">
                  {change.assignee ? `${change.assignee.firstName} ${change.assignee.lastName}` : 'Unassigned'}
                </p>
              </div>
              {change.approver && (
                <div>
                  <label className="text-sm text-muted-foreground">Approved By</label>
                  <p className="font-medium">
                    {change.approver.firstName} {change.approver.lastName}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Created</label>
                <p className="font-medium">{format(new Date(change.createdAt), 'MMM d, yyyy HH:mm')}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Last Updated</label>
                <p className="font-medium">{format(new Date(change.updatedAt), 'MMM d, yyyy HH:mm')}</p>
              </div>
              {change.scheduledStartDate && (
                <div>
                  <label className="text-sm text-muted-foreground">Scheduled Start</label>
                  <p className="font-medium">{format(new Date(change.scheduledStartDate), 'MMM d, yyyy HH:mm')}</p>
                </div>
              )}
              {change.scheduledEndDate && (
                <div>
                  <label className="text-sm text-muted-foreground">Scheduled End</label>
                  <p className="font-medium">{format(new Date(change.scheduledEndDate), 'MMM d, yyyy HH:mm')}</p>
                </div>
              )}
              {change.approvedAt && (
                <div>
                  <label className="text-sm text-muted-foreground">Approved</label>
                  <p className="font-medium">{format(new Date(change.approvedAt), 'MMM d, yyyy HH:mm')}</p>
                </div>
              )}
              {change.rejectedAt && (
                <div>
                  <label className="text-sm text-muted-foreground">Rejected</label>
                  <p className="font-medium">{format(new Date(change.rejectedAt), 'MMM d, yyyy HH:mm')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {change.rejectedReason && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Rejection Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{change.rejectedReason}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Change Request"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()}>
              Delete
            </Button>
          </div>
        }
      >
        <p>Are you sure you want to delete this change request? This action cannot be undone.</p>
      </Modal>

      {/* Link Asset Modal */}
      <Modal
        isOpen={showLinkAsset}
        onClose={() => { setShowLinkAsset(false); setAssetSearch(''); setSelectedAsset(null); }}
        title="Link Asset"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowLinkAsset(false); setAssetSearch(''); setSelectedAsset(null); }}>
              Cancel
            </Button>
            <Button disabled={!selectedAsset} onClick={() => linkAssetMutation.mutate({ assetId: selectedAsset.id })}>
              Link Asset
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Search Assets"
            placeholder="Search by name or asset tag..."
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
          />
          {assetSearch.length >= 2 && (
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              {assetSearchResults?.map((asset: any) => (
                <button
                  key={asset.id}
                  className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-b-0"
                  onClick={() => { setSelectedAsset(asset); setAssetSearch(''); }}
                >
                  <p className="font-medium">{asset.name}</p>
                  <p className="text-sm text-muted-foreground">{asset.assetTag}</p>
                </button>
              ))}
            </div>
          )}
          {selectedAsset && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="font-medium">{selectedAsset.name}</p>
              <p className="text-sm text-muted-foreground">{selectedAsset.assetTag}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Link Ticket Modal */}
      <Modal
        isOpen={showLinkTicket}
        onClose={() => { setShowLinkTicket(false); setTicketSearch(''); setSelectedTicket(null); }}
        title="Link Ticket"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowLinkTicket(false); setTicketSearch(''); setSelectedTicket(null); }}>
              Cancel
            </Button>
            <Button disabled={!selectedTicket} onClick={() => linkTicketMutation.mutate({ ticketId: selectedTicket.id })}>
              Link Ticket
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
                  <p className="font-mono text-sm">{ticket.ticketNumber}</p>
                  <p className="font-medium">{ticket.title}</p>
                </button>
              ))}
            </div>
          )}
          {selectedTicket && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="font-mono text-sm">{selectedTicket.ticketNumber}</p>
              <p className="font-medium">{selectedTicket.title}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Link Problem Modal */}
      <Modal
        isOpen={showLinkProblem}
        onClose={() => { setShowLinkProblem(false); setProblemSearch(''); setSelectedProblem(null); }}
        title="Link Problem"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowLinkProblem(false); setProblemSearch(''); setSelectedProblem(null); }}>
              Cancel
            </Button>
            <Button disabled={!selectedProblem} onClick={() => linkProblemMutation.mutate({ problemId: selectedProblem.id })}>
              Link Problem
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Search Problems"
            placeholder="Search by problem number or title..."
            value={problemSearch}
            onChange={(e) => setProblemSearch(e.target.value)}
          />
          {problemSearch.length >= 2 && (
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              {problemSearchResults?.map((problem: any) => (
                <button
                  key={problem.id}
                  className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-b-0"
                  onClick={() => { setSelectedProblem(problem); setProblemSearch(''); }}
                >
                  <p className="font-mono text-sm">{problem.problemNumber}</p>
                  <p className="font-medium">{problem.title}</p>
                </button>
              ))}
            </div>
          )}
          {selectedProblem && (
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="font-mono text-sm">{selectedProblem.problemNumber}</p>
              <p className="font-medium">{selectedProblem.title}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Risk Assessment Modal */}
      <Modal
        isOpen={showRiskAssessment}
        onClose={() => { setShowRiskAssessment(false); setIsEditingRisk(false); }}
        title={isEditingRisk ? 'Edit Risk Assessment' : 'Add Risk Assessment'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowRiskAssessment(false); setIsEditingRisk(false); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (isEditingRisk) {
                  updateRiskMutation.mutate(riskForm);
                } else {
                  createRiskMutation.mutate(riskForm);
                }
              }}
              disabled={createRiskMutation.isPending || updateRiskMutation.isPending}
            >
              {isEditingRisk ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Risk Level"
            value={riskForm.riskLevel}
            onChange={(e) => setRiskForm({ ...riskForm, riskLevel: e.target.value })}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
          <Textarea
            label="Risk Description"
            value={riskForm.riskDescription}
            onChange={(e) => setRiskForm({ ...riskForm, riskDescription: e.target.value })}
            placeholder="Describe the potential risks..."
            rows={2}
          />
          <Textarea
            label="Mitigation Steps"
            value={riskForm.mitigationSteps}
            onChange={(e) => setRiskForm({ ...riskForm, mitigationSteps: e.target.value })}
            placeholder="How will these risks be mitigated?"
            rows={3}
          />
          <Textarea
            label="Contingency Plan"
            value={riskForm.contingencyPlan}
            onChange={(e) => setRiskForm({ ...riskForm, contingencyPlan: e.target.value })}
            placeholder="What is the backup plan if things go wrong?"
            rows={3}
          />
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason(''); }}
        title="Reject Change Request"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason}
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Textarea
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why is this change being rejected?"
            rows={3}
            required
          />
        </div>
      </Modal>
    </div>
  );
}
