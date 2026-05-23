import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi, reportsApi } from '../api/client';
import { useLicense } from '../hooks/useLicense';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { Ticket, AlertTriangle, CheckCircle, Clock, Inbox, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrentOrganizationId } from '../stores/organizationStore';

export function DashboardPage() {
  const organizationId = useCurrentOrganizationId();
  const { licenseStatus } = useLicense(organizationId || '');

  // Check if reports module is available (Premium/Enterprise only)
  // hasReportsModule should be explicitly false (not undefined) for the query to be disabled
  const hasReportsModule = licenseStatus?.modules?.includes('reports') === true;

  // Always fetch basic dashboard stats (available for all tiers)
  const { data: basicStats, isLoading: basicLoading } = useQuery({
    queryKey: ['dashboard-basic', organizationId],
    queryFn: () => dashboardApi.getStats().then((r) => r.data),
    enabled: !!organizationId,
  });

  // Fetch advanced reports only if reports module is available
  // Only enable if hasReportsModule is explicitly true
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['dashboard-reports', organizationId],
    queryFn: () => reportsApi.dashboard().then((r) => r.data),
    enabled: !!organizationId && hasReportsModule === true,
    retry: false, // Don't retry failed requests
  });

  // Determine which data to use - advanced reports or basic stats
  const dashboard = hasReportsModule ? reportsData : basicStats;
  const isLoading = hasReportsModule ? reportsLoading : basicLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    { name: 'Total Tickets', value: dashboard?.totalTickets || 0, icon: Ticket, color: 'text-blue-600' },
    { name: 'Open Tickets', value: dashboard?.openTickets || 0, icon: Clock, color: 'text-yellow-600' },
    { name: 'Resolved Today', value: dashboard?.resolvedToday || 0, icon: CheckCircle, color: 'text-green-600' },
    { name: 'SLA Breached', value: dashboard?.slaBreached || 0, icon: AlertTriangle, color: 'text-red-600' },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's an overview of your helpdesk.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`w-10 h-10 ${stat.color} opacity-20`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row - only show for Premium/Enterprise */}
      {hasReportsModule && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Tickets by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(dashboard?.ticketsByStatus || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="font-medium">{String(count)}</span>
                  </div>
                ))}
                {(!dashboard?.ticketsByStatus || Object.keys(dashboard.ticketsByStatus).length === 0) && (
                  <p className="text-muted-foreground text-sm">No tickets yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Tickets by Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(dashboard?.ticketsByPriority || {}).map(([priority, count]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <PriorityBadge priority={priority} />
                    <span className="font-medium">{String(count)}</span>
                  </div>
                ))}
                {(!dashboard?.ticketsByPriority || Object.keys(dashboard.ticketsByPriority).length === 0) && (
                  <p className="text-muted-foreground text-sm">No tickets yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upgrade message for Basic/Standard tier */}
      {!hasReportsModule && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium">Detailed Analytics Available</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upgrade to Premium or Enterprise license to access ticket trends, priority distribution, and advanced analytics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Tickets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Tickets</CardTitle>
          <Link to="/tickets" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(dashboard?.recentTickets || []).slice(0, 5).map((ticket: any) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">
                      {ticket.ticketNumber}
                    </span>
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                  <p className="font-medium mt-1">{ticket.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {ticket.requester?.firstName} {ticket.requester?.lastName}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                </div>
              </Link>
            ))}
            {(!dashboard?.recentTickets || dashboard.recentTickets.length === 0) && (
              <p className="text-muted-foreground text-sm">No recent tickets</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}