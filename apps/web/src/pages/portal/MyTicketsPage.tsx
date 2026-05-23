import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Search, Plus, Clock, CheckCircle, ShoppingCart, ArrowRight, Inbox } from 'lucide-react';
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

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function MyTicketsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // Fetch user's tickets
  const { data, isLoading } = useQuery({
    queryKey: ['my-tickets', search, status],
    queryFn: () =>
      ticketsApi.list({
        page: 1,
        limit: 50,
        search: search || undefined,
        status: status ? [status] : undefined,
      }).then((r) => r.data),
  });

  const tickets = data?.items || [];
  const openTickets = tickets.filter((t: TicketSummary) => !['resolved', 'closed'].includes(t.status));
  const resolvedTickets = tickets.filter((t: TicketSummary) => ['resolved', 'closed'].includes(t.status));

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Requests</h1>
            <p className="text-sm text-muted-foreground">
              {data?.total || 0} total requests
            </p>
          </div>
          <Link to="/tickets/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatus('')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">All Requests</p>
                  <p className="text-2xl font-bold mt-1">{tickets.length}</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                  <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatus('')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold mt-1">{openTickets.length}</p>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                  <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatus('resolved')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold mt-1">{resolvedTickets.length}</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Link to="/service-catalog">
            <Card className="hover:shadow-md transition cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Service Catalog</h3>
                    <p className="text-sm text-muted-foreground">Browse available services</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/knowledge-base">
            <Card className="hover:shadow-md transition cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <Search className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Knowledge Base</h3>
                    <p className="text-sm text-muted-foreground">Find answers and guides</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Tickets List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">No requests found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {search || status
                    ? 'Try adjusting your search or filters'
                    : 'You haven\'t submitted any requests yet'}
                </p>
                <Link to="/service-catalog">
                  <Button variant="outline">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Browse Service Catalog
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((ticket: TicketSummary) => (
                  <Link
                    key={ticket.id}
                    to={`/tickets/${ticket.id}`}
                    className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-muted-foreground">
                          {ticket.ticketNumber}
                        </span>
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 capitalize">
                          {ticket.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="font-medium truncate">{ticket.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}