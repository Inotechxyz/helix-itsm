import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { serviceCatalogApi } from '../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  MessageSquare,
  AlertCircle,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function ServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: request, isLoading, error } = useQuery({
    queryKey: ['service-request', id],
    queryFn: () => serviceCatalogApi.requests.get(id!).then((r: any) => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto pr-2">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
          </div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Service Request Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The service request you're looking for doesn't exist or has been removed.
          </p>
          <Link to="/service-catalog">
            <Button>Back to Service Catalog</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/portal"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{request.requestNumber}</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusColors[request.status] || ''}`}>
                {statusLabels[request.status] || request.status}
              </span>
            </div>
          </div>
        </div>

        {/* Service Info */}
        <Card>
          <CardHeader>
            <CardTitle>{request.service?.name || 'Service'}</CardTitle>
          </CardHeader>
          <CardContent>
            {request.service?.category && (
              <p className="text-sm text-muted-foreground mb-4">
                Category: {request.service.category.name}
              </p>
            )}

            {request.justification && (
              <div className="mb-4">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Justification
                </h3>
                <p className="text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                  {request.justification}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Requested by: {request.requester?.firstName} {request.requester?.lastName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Submitted: {format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Request Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Request Created */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${request.createdAt ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Send className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="w-0.5 h-8 bg-gray-200"></div>
                </div>
                <div className="flex-1 pb-4">
                  <p className="font-medium">Request Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    {request.createdAt && format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              {/* Approval (if required) */}
              {request.approvalRequired && (
                <>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        ['approved', 'in_progress', 'completed'].includes(request.status) ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {request.status === 'rejected' ? (
                          <XCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <CheckCircle className={`w-4 h-4 ${
                            ['approved', 'in_progress', 'completed'].includes(request.status) ? 'text-green-600' : 'text-gray-400'
                          }`} />
                        )}
                      </div>
                      {request.status !== 'completed' && request.status !== 'rejected' && request.status !== 'cancelled' && (
                        <div className="w-0.5 h-8 bg-gray-200"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium">Approval {request.status === 'rejected' ? 'Rejected' : 'Status'}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.status === 'pending_approval' && 'Awaiting approval from manager'}
                        {request.status === 'approved' && 'Request approved'}
                        {request.status === 'rejected' && 'Request rejected'}
                        {['in_progress', 'completed'].includes(request.status) && 'Approved'}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* In Progress / Completed */}
              {['in_progress', 'completed'].includes(request.status) && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {request.status === 'completed' ? 'Request Completed' : 'Being Processed'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {request.status === 'completed' && request.completedAt && (
                        <>Completed on {format(new Date(request.completedAt), 'MMM d, yyyy h:mm a')}</>
                      )}
                      {request.status === 'in_progress' && 'Your request is being processed'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SLA Deadline */}
        {request.slaDeadline && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded-full">
                    <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-medium">SLA Deadline</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(request.slaDeadline), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
                {new Date(request.slaDeadline) < new Date() && request.status !== 'completed' && (
                  <Badge variant="destructive">Overdue</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assigned Agent */}
        {request.assignedAgent && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned to</p>
                  <p className="font-medium">{request.assignedAgent.firstName} {request.assignedAgent.lastName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4">
          <Link to="/service-catalog">
            <Button variant="outline">
              Browse More Services
            </Button>
          </Link>
          {request.status !== 'completed' && request.status !== 'cancelled' && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                if (confirm('Are you sure you want to cancel this request?')) {
                  serviceCatalogApi.requests.cancel(request.id).then(() => {
                    navigate('/portal');
                  });
                }
              }}
            >
              Cancel Request
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}