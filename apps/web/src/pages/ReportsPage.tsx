import { useQuery } from '@tanstack/react-query';
import { reportsApi, csatApi } from '../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { BarChart3, TrendingUp, Clock, AlertTriangle, Target, Zap, CheckCircle, Star, ThumbsUp } from 'lucide-react';
import { ModuleErrorHandler } from '../hooks/useModuleGuard';

export function ReportsPage() {
  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => reportsApi.dashboard().then((r) => r.data),
    retry: false,
  });

  const { data: volumeTrends } = useQuery({
    queryKey: ['volume-trends'],
    queryFn: () => reportsApi.volume({ groupBy: 'day' }).then((r) => r.data),
  });

  const { data: slaCompliance } = useQuery({
    queryKey: ['sla-compliance'],
    queryFn: () => reportsApi.slaCompliance().then((r) => r.data),
  });

  const { data: kpiMetrics } = useQuery({
    queryKey: ['kpi-metrics'],
    queryFn: () => reportsApi.kpiMetrics().then((r) => r.data),
  });

  const { data: csatAnalytics } = useQuery({
    queryKey: ['csat-analytics'],
    queryFn: () => csatApi.getAnalytics().then((r) => r.data),
  });

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <ModuleErrorHandler error={error} moduleName="Reports">
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">Insights into your helpdesk performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                <p className="text-3xl font-bold">{dashboard?.totalTickets || 0}</p>
              </div>
              <BarChart3 className="w-10 h-10 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Resolution</p>
                <p className="text-3xl font-bold">
                  {dashboard?.avgResolutionTime?.toFixed(1) || 0}h
                </p>
              </div>
              <Clock className="w-10 h-10 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resolved Today</p>
                <p className="text-3xl font-bold">{dashboard?.resolvedToday || 0}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SLA Compliance</p>
                <p className="text-3xl font-bold">
                  {slaCompliance?.complianceRate?.toFixed(1) || 100}%
                </p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard?.ticketsByStatus &&
                Object.entries(dashboard.ticketsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${((count as number) / (dashboard.totalTickets || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="font-medium w-8 text-right">{String(count)}</span>
                    </div>
                  </div>
                ))}
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
              {dashboard?.ticketsByPriority &&
                Object.entries(dashboard.ticketsByPriority).map(([priority, count]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <span className="capitalize">{priority}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            priority === 'critical'
                              ? 'bg-red-500'
                              : priority === 'high'
                              ? 'bg-orange-500'
                              : priority === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${((count as number) / (dashboard.totalTickets || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="font-medium w-8 text-right">{String(count)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Compliance Details */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-3xl font-bold text-green-600">
                {slaCompliance?.compliant || 0}
              </p>
              <p className="text-sm text-muted-foreground">Compliant</p>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-3xl font-bold text-red-600">
                {slaCompliance?.breached || 0}
              </p>
              <p className="text-sm text-muted-foreground">Breached</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-3xl font-bold">
                {slaCompliance?.complianceRate?.toFixed(1) || 100}%
              </p>
              <p className="text-sm text-muted-foreground">Compliance Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Metrics Section */}
      <Card>
        <CardHeader>
          <CardTitle>Key Performance Indicators (KPIs)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {/* MTTR Card */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-medium">MTTR</span>
                <span className="text-xs text-muted-foreground ml-auto">Mean Time to Resolution</span>
              </div>
              <p className="text-3xl font-bold text-blue-600">
                {kpiMetrics?.mttr?.overall?.toFixed(1) || 0}h
              </p>
              <p className="text-sm text-muted-foreground mt-1">Average resolution time</p>
            </div>

            {/* FRT Card */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-amber-600" />
                <span className="font-medium">First Response</span>
                <span className="text-xs text-muted-foreground ml-auto">Avg: {kpiMetrics?.frt?.overall?.toFixed(1) || 0}h</span>
              </div>
              <p className="text-3xl font-bold text-amber-600">
                {kpiMetrics?.frt?.breachedRate?.toFixed(1) || 0}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {kpiMetrics?.frt?.breached || 0} of {kpiMetrics?.totalTickets || 0} breached
              </p>
            </div>

            {/* FCR Card */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">First Contact Resolution</span>
                <span className="text-xs text-muted-foreground ml-auto">FCR</span>
              </div>
              <p className="text-3xl font-bold text-green-600">
                {kpiMetrics?.firstContactResolution?.overall?.toFixed(1) || 0}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {kpiMetrics?.firstContactResolution?.resolvedWithoutResponse || 0} of {kpiMetrics?.resolvedTickets || 0} resolved
              </p>
            </div>
          </div>

          {/* KPI Details */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* MTTR by Priority */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                MTTR by Priority
              </h4>
              <div className="space-y-2">
                {kpiMetrics?.mttr?.byPriority && Object.entries(kpiMetrics.mttr.byPriority).map(([priority, hours]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <span className="capitalize text-sm">{priority}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            priority === 'critical'
                              ? 'bg-red-500'
                              : priority === 'high'
                              ? 'bg-orange-500'
                              : priority === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(((hours as number) / 24) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">{(hours as number).toFixed(1)}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA Compliance Details */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                SLA Compliance Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {kpiMetrics?.slaCompliance?.frtCompliance?.toFixed(1) || 100}%
                  </p>
                  <p className="text-xs text-muted-foreground">FRT Compliance</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {kpiMetrics?.slaCompliance?.resolutionCompliance?.toFixed(1) || 100}%
                  </p>
                  <p className="text-xs text-muted-foreground">Resolution Compliance</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSAT Section */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Satisfaction (CSAT)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            {/* Average Rating */}
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                <span className="text-3xl font-bold">{csatAnalytics?.averageRating?.toFixed(1) || 0}</span>
              </div>
              <p className="text-sm text-muted-foreground">Avg Rating</p>
            </div>

            {/* Satisfaction Score */}
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <ThumbsUp className="w-6 h-6 text-green-600" />
                <span className="text-3xl font-bold text-green-600">
                  {csatAnalytics?.satisfactionScore?.toFixed(0) || 0}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Satisfaction</p>
            </div>

            {/* NPS Score */}
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                <span className="text-3xl font-bold text-blue-600">
                  {csatAnalytics?.npsScore?.toFixed(0) || 0}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">NPS Score</p>
            </div>

            {/* Response Rate */}
            <div className="text-center p-4 border rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <BarChart3 className="w-6 h-6 text-purple-600" />
                <span className="text-3xl font-bold text-purple-600">
                  {csatAnalytics?.responseRate?.toFixed(0) || 0}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Response Rate</p>
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-3">Rating Distribution</h4>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = csatAnalytics?.ratingDistribution?.[rating] || 0;
                  const total = csatAnalytics?.totalResponses || 1;
                  const percentage = (count / total) * 100;
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="w-6 text-sm">{rating}</span>
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Priority */}
            <div>
              <h4 className="font-medium mb-3">CSAT by Priority</h4>
              <div className="space-y-2">
                {csatAnalytics?.byPriority && Object.entries(csatAnalytics.byPriority).map(([priority, data]: [string, any]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <span className="capitalize text-sm">{priority}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            (data.avgRating || 0) >= 4
                              ? 'bg-green-500'
                              : (data.avgRating || 0) >= 3
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${((data.avgRating || 0) / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {(data.avgRating || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
                {(!csatAnalytics?.byPriority || Object.keys(csatAnalytics.byPriority).length === 0) && (
                  <p className="text-sm text-muted-foreground">No CSAT data available</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </ModuleErrorHandler>
  );
}
