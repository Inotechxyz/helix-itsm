import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceCatalogApi } from '../../api/client';
import { showToast } from '../../components/ui/Toast';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  User,
  Calendar,
  MessageSquare,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

interface ServiceRequest {
  id: string;
  requestNumber: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  slaDeadline?: string;
  justification?: string;
  formData?: Record<string, any>;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  service: {
    id: string;
    name: string;
    slug: string;
    category?: { name: string };
  };
  linkedTicket?: {
    id: string;
    ticketNumber: string;
  };
  approvalComments?: string;
  completionNotes?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: Clock },
  pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: X },
};

const statusTabs = [
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

export function AdminServiceRequestsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending_approval');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [actionModal, setActionModal] = useState<'approve' | 'reject' | 'complete' | null>(null);
  const [actionComments, setActionComments] = useState('');

  // Fetch requests
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-service-requests', activeTab],
    queryFn: () => {
      const params: any = { page: 1, limit: 50 };
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      return serviceCatalogApi.requests.list(params).then((r: any) => r.data);
    },
  });

  // Fetch pending approvals count
  const { data: pendingStats } = useQuery({
    queryKey: ['service-requests-pending-count'],
    queryFn: () => serviceCatalogApi.stats.pendingApprovals().then((r: any) => r.data),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) =>
      serviceCatalogApi.requests.approve(id, comments),
    onSuccess: () => {
      showToast('Request approved successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-service-requests'] });
      queryClient.invalidateQueries({ queryKey: ['service-requests-pending-count'] });
      setActionModal(null);
      setActionComments('');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to approve request', 'error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      serviceCatalogApi.requests.reject(id, comments),
    onSuccess: () => {
      showToast('Request rejected', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-service-requests'] });
      queryClient.invalidateQueries({ queryKey: ['service-requests-pending-count'] });
      setActionModal(null);
      setActionComments('');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to reject request', 'error');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      serviceCatalogApi.requests.complete(id, data),
    onSuccess: () => {
      showToast('Request completed', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-service-requests'] });
      queryClient.invalidateQueries({ queryKey: ['service-requests-pending-count'] });
      setActionModal(null);
      setActionComments('');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to complete request', 'error');
    },
  });

  const requests = data?.items || [];
  const pendingCount = pendingStats?.total || 0;

  // Filter by search
  const filteredRequests = requests.filter((r: ServiceRequest) =>
    r.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
    r.requester?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    r.requester?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    r.service?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAction = () => {
    if (!selectedRequest) return;

    if (actionModal === 'approve') {
      approveMutation.mutate({ id: selectedRequest.id, comments: actionComments || undefined });
    } else if (actionModal === 'reject') {
      if (!actionComments.trim()) {
        showToast('Please provide a reason for rejection', 'error');
        return;
      }
      rejectMutation.mutate({ id: selectedRequest.id, comments: actionComments });
    } else if (actionModal === 'complete') {
      completeMutation.mutate({ id: selectedRequest.id, data: actionComments ? { notes: actionComments } : undefined });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Service Requests</h1>
            <p className="text-sm text-muted-foreground">
              Manage and process service requests from users
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by request number, requester, or service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('pending_approval')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('in_progress')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-xl">
                  <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">
                    {data?.inProgressCount || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('completed')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">
                    {data?.completedCount || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setActiveTab('all')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-xl">
                  <Search className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{data?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {statusTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === 'pending_approval' && pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Requests List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">No requests found</h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'pending_approval'
                    ? 'No requests pending approval'
                    : 'No requests match your filters'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredRequests.map((request: ServiceRequest) => {
                  const config = statusConfig[request.status] || statusConfig.draft;
                  const StatusIcon = config.icon;
                  const isOverdue = request.slaDeadline && new Date(request.slaDeadline) < new Date() &&
                    !['completed', 'cancelled', 'rejected'].includes(request.status);

                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-sm font-medium">
                            {request.requestNumber}
                          </span>
                          <Badge className={config.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          {isOverdue && (
                            <Badge variant="destructive">Overdue</Badge>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                            {request.service?.category?.name || request.service?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {request.requester?.firstName} {request.requester?.lastName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(request.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="font-medium mt-1 truncate">{request.service?.name}</p>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {/* Quick Actions */}
                        {request.status === 'pending_approval' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setActionModal('approve');
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedRequest(request);
                                setActionModal('reject');
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {request.status === 'in_progress' ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionModal('complete');
                            }}
                          >
                            Complete
                          </Button>
                        ) : null}
                        {request.linkedTicket && (
                          <a
                            href={`/tickets/${request.linkedTicket.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Modal */}
      {actionModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {actionModal === 'approve' && 'Approve Request'}
                {actionModal === 'reject' && 'Reject Request'}
                {actionModal === 'complete' && 'Complete Request'}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => {
                setActionModal(null);
                setActionComments('');
              }}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Request</p>
                <p className="font-medium">{selectedRequest.requestNumber} - {selectedRequest.service?.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Requested by: {selectedRequest.requester?.firstName} {selectedRequest.requester?.lastName}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {actionModal === 'approve' && 'Comments (optional)'}
                  {actionModal === 'reject' && 'Reason for rejection (required)'}
                  {actionModal === 'complete' && 'Completion notes (optional)'}
                </label>
                <textarea
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                  rows={3}
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  placeholder={
                    actionModal === 'approve' ? 'Add any comments...' :
                    actionModal === 'reject' ? 'Please explain why this request is being rejected...' :
                    'Add completion notes...'
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              <Button variant="outline" onClick={() => {
                setActionModal(null);
                setActionComments('');
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={
                  (actionModal === 'reject' && !actionComments.trim()) ||
                  approveMutation.isPending ||
                  rejectMutation.isPending ||
                  completeMutation.isPending
                }
              >
                {actionModal === 'approve' && 'Approve'}
                {actionModal === 'reject' && 'Reject'}
                {actionModal === 'complete' && 'Complete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request Detail Modal */}
      {selectedRequest && !actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b bg-white dark:bg-gray-800">
              <div>
                <h3 className="text-lg font-semibold">{selectedRequest.requestNumber}</h3>
                <Badge className={statusConfig[selectedRequest.status]?.color}>
                  {statusConfig[selectedRequest.status]?.label}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Service Info */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="font-medium mb-2">Service</h4>
                <p className="text-lg">{selectedRequest.service?.name}</p>
                {selectedRequest.service?.category && (
                  <p className="text-sm text-muted-foreground">
                    Category: {selectedRequest.service.category.name}
                  </p>
                )}
              </div>

              {/* Requester Info */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="font-medium mb-2">Requested By</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {selectedRequest.requester?.firstName} {selectedRequest.requester?.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.requester?.email}</p>
                  </div>
                </div>
              </div>

              {/* Justification */}
              {selectedRequest.justification && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Justification
                  </h4>
                  <p className="text-muted-foreground">{selectedRequest.justification}</p>
                </div>
              )}

              {/* Form Data */}
              {selectedRequest.formData && Object.keys(selectedRequest.formData).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Request Details</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedRequest.formData).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="font-medium mb-2">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{format(new Date(selectedRequest.createdAt), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  {selectedRequest.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span>{format(new Date(selectedRequest.completedAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  )}
                  {selectedRequest.slaDeadline && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SLA Deadline</span>
                      <span className={new Date(selectedRequest.slaDeadline) < new Date() ? 'text-red-600' : ''}>
                        {format(new Date(selectedRequest.slaDeadline), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Ticket */}
              {selectedRequest.linkedTicket && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Linked Ticket</h4>
                  <a
                    href={`/tickets/${selectedRequest.linkedTicket.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-primary hover:underline"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <ExternalLink className="w-4 h-4 text-primary" />
                    </div>
                    <span>
                      {selectedRequest.linkedTicket.ticketNumber}
                    </span>
                  </a>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 flex justify-between gap-3 p-4 border-t bg-white dark:bg-gray-800">
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
              <div className="flex gap-2">
                {selectedRequest.status === 'pending_approval' && (
                  <>
                    <Button
                      variant="outline"
                      className="text-red-600"
                      onClick={() => {
                        setActionModal('reject');
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        setActionModal('approve');
                      }}
                    >
                      Approve
                    </Button>
                  </>
                )}
                {(selectedRequest.status === 'approved' || selectedRequest.status === 'in_progress') && (
                  <Button
                    onClick={() => {
                      setActionModal('complete');
                    }}
                  >
                    Mark Complete
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}