import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi, serviceCatalogApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import {
  Ticket,
  Plus,
  Clock,
  CheckCircle,
  ShoppingCart,
  BookOpen,
  ArrowRight,
  Inbox,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';

interface TicketSummary {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  createdAt: string;
  resolvedAt?: string;
}

interface ServiceRequestSummary {
  id: string;
  requestNumber: string;
  status: string;
  createdAt: string;
  service: { name: string; slug: string };
}

export function SelfServicePortal() {
  const organizationId = useCurrentOrganizationId();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open');

  // Fetch user's tickets
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['my-tickets', organizationId],
    queryFn: () => ticketsApi.list({ page: 1, limit: 50 }).then((r) => r.data),
    enabled: !!organizationId,
  });

  // Fetch user's service requests
  const { data: serviceRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['my-service-requests', organizationId],
    queryFn: () => serviceCatalogApi.stats.myRequests().then((r: any) => r.data),
    enabled: !!organizationId,
  });

  // Filter tickets by status
  const openTickets = tickets?.items?.filter(
    (t: TicketSummary) => !['resolved', 'closed'].includes(t.status)
  ) || [];

  const resolvedTickets = tickets?.items?.filter((t: TicketSummary) =>
    ['resolved', 'closed'].includes(t.status)
  ) || [];

  const displayTickets = activeTab === 'open' ? openTickets : resolvedTickets;
  const totalServiceRequests = serviceRequests?.totalRequests || 0;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* Hero Section with Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Hello, {user?.firstName || 'User'}!
            </h1>
            <p className="text-muted-foreground mt-1">How can we help you today?</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/service-catalog">
              <Button className="w-full sm:w-auto">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Service Request
              </Button>
            </Link>
            <Link to="/tickets/new">
              <Button variant="outline" className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Submit Ticket
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-xl">
                <Ticket className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Tickets</p>
                <p className="text-2xl font-bold">{openTickets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{resolvedTickets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-xl">
                <Send className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Service Requests</p>
                <p className="text-2xl font-bold">{totalServiceRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link to="/knowledge-base">
          <Card className="hover:shadow-md transition h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-xl">
                  <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Knowledge Base</p>
                  <p className="text-sm font-medium">Get help fast</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* My Requests Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>My Requests</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'open' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('open')}
              >
                <Clock className="w-4 h-4 mr-1" />
                Open ({openTickets.length})
              </Button>
              <Button
                variant={activeTab === 'resolved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('resolved')}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Resolved ({resolvedTickets.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ticketsLoading || requestsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : displayTickets.length === 0 && (!serviceRequests?.myRequests || serviceRequests.myRequests.length === 0) ? (
            <div className="text-center py-8">
              <Inbox className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">
                {activeTab === 'open' ? 'No open requests' : 'No resolved requests'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {activeTab === 'open'
                  ? 'You have no open requests at the moment.'
                  : 'You have no resolved requests yet.'}
              </p>
              {activeTab === 'open' && (
                <Link to="/service-catalog">
                  <Button variant="outline">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Browse Service Catalog
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Display Tickets */}
              {displayTickets.map((ticket: TicketSummary) => (
                <Link
                  key={`ticket-${ticket.id}`}
                  to={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-muted-foreground">
                        {ticket.ticketNumber}
                      </span>
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                        Ticket
                      </span>
                    </div>
                    <p className="font-medium mt-1 truncate">{ticket.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
                </Link>
              ))}

              {/* Display Service Requests */}
              {serviceRequests?.myRequests?.map((request: ServiceRequestSummary) => (
                <Link
                  key={`request-${request.id}`}
                  to={`/service-requests/${request.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-muted-foreground">
                        {request.requestNumber}
                      </span>
                      <StatusBadge status={request.status} />
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                        Service
                      </span>
                    </div>
                    <p className="font-medium mt-1 truncate">{request.service?.name || 'Service Request'}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(request.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}