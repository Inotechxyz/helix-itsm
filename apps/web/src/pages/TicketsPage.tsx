import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ticketsApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { Plus, Search, Filter, LayoutGrid, List } from 'lucide-react';
import { format } from 'date-fns';
import { ModuleErrorHandler } from '../hooks/useModuleGuard';
import { TicketDetailPanel } from '../components/tickets/TicketDetailPanel';
import { clsx } from 'clsx';
import { useCurrentOrganizationId } from '../stores/organizationStore';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const priorityOptions = [
  { value: '', label: 'All Priority' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'list'>('split');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const organizationId = useCurrentOrganizationId();

  // Check for highlight parameter in URL
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      setSelectedTicketId(highlightId);
      // Clear the highlight param
      searchParams.delete('highlight');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', organizationId, page, search, status, priority],
    queryFn: () =>
      ticketsApi
        .list({
          page,
          limit: 50,
          search: search || undefined,
          status: status ? [status] : undefined,
          priority: priority ? [priority] : undefined,
        })
        .then((r) => r.data),
    enabled: !!organizationId,
    retry: false,
  });

  // Auto-select first ticket if none selected
  useEffect(() => {
    if (data?.items?.length > 0 && !selectedTicketId) {
      setSelectedTicketId(data.items[0].id);
    }
  }, [data, selectedTicketId]);

  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    if (viewMode === 'list') {
      // Navigate to detail page
      window.location.href = `/app/tickets/${ticketId}`;
    }
  };

  return (
    <ModuleErrorHandler error={error} moduleName="Tickets">
      <div className="h-full flex flex-col min-h-0">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b bg-background">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tickets</h1>
              <p className="text-sm text-muted-foreground">
                {data?.total || 0} total tickets
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'split' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('split')}
                  className={clsx(
                    'rounded-r-none',
                    viewMode === 'split' && 'bg-primary text-primary-foreground'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={clsx(
                    'rounded-l-none',
                    viewMode === 'list' && 'bg-primary text-primary-foreground'
                  )}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              <Link to="/tickets/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Ticket
                </Button>
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="flex-shrink-0 flex flex-col md:flex-row gap-3 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
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
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background"
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {viewMode === 'split' ? (
            <>
              {/* Left Panel - Ticket List */}
              <div className="w-[400px] flex-shrink-0 border-r bg-gray-50/50 dark:bg-gray-900/50 flex flex-col min-h-0">
                {/* Ticket List - Scrollable */}
                <div className="flex-1 overflow-y-auto p-2">
                  {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                  ) : data?.items?.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No tickets found
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {data?.items?.map((ticket: any) => (
                        <button
                          key={ticket.id}
                          onClick={() => handleTicketClick(ticket.id)}
                          className={clsx(
                            'w-full text-left p-3 rounded-lg transition',
                            selectedTicketId === ticket.id
                              ? 'bg-primary/10 border border-primary/30 dark:bg-primary/20'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-muted-foreground">
                              {ticket.ticketNumber}
                            </span>
                            <StatusBadge status={ticket.status} />
                            <PriorityBadge priority={ticket.priority} />
                          </div>
                          <p className={clsx(
                            'font-medium text-sm truncate',
                            selectedTicketId === ticket.id && 'text-primary'
                          )}>
                            {ticket.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>
                              {ticket.requester?.firstName} {ticket.requester?.lastName}
                            </span>
                            <span>•</span>
                            <span>{format(new Date(ticket.createdAt), 'MMM d')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination - Fixed at bottom */}
                {data?.totalPages > 1 && (
                  <div className="p-2 border-t bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Page {page} of {data.totalPages}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={page === 1}
                          onClick={() => setPage(page - 1)}
                          className="h-7 px-2"
                        >
                          Prev
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={page >= data.totalPages}
                          onClick={() => setPage(page + 1)}
                          className="h-7 px-2"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel - Ticket Detail */}
              <div className="flex-1 overflow-hidden min-h-0">
                <TicketDetailPanel
                  ticketId={selectedTicketId}
                  tickets={data?.items || []}
                  onSelectTicket={setSelectedTicketId}
                />
              </div>
            </>
          ) : (
            /* List View - Full width, click to navigate */
            <div className="flex-1 overflow-y-auto p-6">
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                  ) : data?.items?.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No tickets found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {data?.items?.map((ticket: any) => (
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
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                                {ticket.type === 'incident' ? 'Incident' : 'Service Request'}
                              </span>
                            </div>
                            <p className="font-medium truncate">{ticket.title}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span>
                                {ticket.requester?.firstName} {ticket.requester?.lastName}
                              </span>
                              {ticket.assignedAgent && (
                                <span>Assigned to: {ticket.assignedAgent.firstName}</span>
                              )}
                              <span>{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {ticket._count?.comments > 0 && (
                              <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                                {ticket._count.comments} comments
                              </span>
                            )}
                            {ticket._count?.attachments > 0 && (
                              <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                                {ticket._count.attachments} files
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pagination */}
              {data?.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, data.total)} of {data.total} results
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModuleErrorHandler>
  );
}
