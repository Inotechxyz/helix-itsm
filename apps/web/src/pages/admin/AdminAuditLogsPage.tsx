import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Search, Download, ChevronLeft, ChevronRight, Filter, X, FileText, User, Clock, Activity, Info, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrentOrganizationId } from '../../stores/organizationStore';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  method: string;
  path: string;
  ipAddress?: string;
  userAgent?: string;
  executionTimeMs?: number;
  statusCode?: number;
  changes?: any;
  metadata?: any;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  CREATE_FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  UPDATE_FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  DELETE_FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

const entityTypeLabels: Record<string, string> = {
  tickets: 'Tickets',
  users: 'Users',
  teams: 'Teams',
  organizations: 'Organizations',
  knowledge_base: 'Knowledge Base',
  service_catalog: 'Service Catalog',
  assets: 'Assets',
  problems: 'Problems',
  changes: 'Changes',
  sla_policies: 'SLA Policies',
  ola_policies: 'OLA Policies',
  software_licenses: 'Software Licenses',
  reports: 'Reports',
  license: 'License',
  email_settings: 'Email Settings',
  azure_ad: 'Azure AD',
  invitations: 'Invitations',
};

export function AdminAuditLogsPage() {
  const organizationId = useCurrentOrganizationId();
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const queryParams = {
    page,
    limit,
    search: search || undefined,
    entityType: filters.entityType || undefined,
    action: filters.action || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    organizationId: organizationId || undefined,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => auditApi.list(queryParams).then((r) => r.data),
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 403 Forbidden (permission denied)
      if ((error as any)?.response?.status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Check if the error is a 403 Forbidden (permission denied)
  const isForbidden = isError && (error as any)?.response?.status === 403;

  const { data: stats } = useQuery({
    queryKey: ['audit-stats', organizationId],
    queryFn: () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return auditApi.getStats({
        startDate: thirtyDaysAgo.toISOString(),
        endDate: now.toISOString(),
        organizationId: organizationId || undefined,
      }).then((r) => r.data);
    },
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
    gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
    enabled: !!organizationId, // Only fetch if we have an organization ID
  });

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await auditApi.export({
        format,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        organizationId: organizationId || undefined,
        entityType: filters.entityType || undefined,
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const clearFilters = () => {
    setFilters({
      entityType: '',
      action: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  const hasActiveFilters = filters.entityType || filters.action || filters.startDate || filters.endDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            Track all system changes and user actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1">
                {Object.values(filters).filter(Boolean).length}
              </Badge>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('json')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Actions (30d)</p>
                  <p className="text-2xl font-bold">{stats.totalActions}</p>
                </div>
                <Activity className="w-10 h-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Creates</p>
                  <p className="text-2xl font-bold">{stats.byAction?.CREATE || 0}</p>
                </div>
                <FileText className="w-10 h-10 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Updates</p>
                  <p className="text-2xl font-bold">{stats.byAction?.UPDATE || 0}</p>
                </div>
                <User className="w-10 h-10 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Deletes</p>
                  <p className="text-2xl font-bold">{stats.byAction?.DELETE || 0}</p>
                </div>
                <Clock className="w-10 h-10 text-red-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <label className="block text-sm font-medium mb-1">Entity Type</label>
                <select
                  value={filters.entityType}
                  onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                >
                  <option value="">All</option>
                  {Object.entries(entityTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <select
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                >
                  <option value="">All</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="secondary" onClick={clearFilters} className="flex items-center gap-1">
                  <X className="w-4 h-4" />
                  Clear
                </Button>
                <Button onClick={() => { setPage(1); refetch(); }}>
                  Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by entity ID, user email, or path..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: List + Detail Panel */}
      <div className="flex gap-6">
        {/* Left Column - Logs Table */}
        <div className={`${selectedLog ? 'w-1/2' : 'w-full'}`}>
          <Card>
            <CardHeader>
              <CardTitle>Audit Log Entries</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : isForbidden ? (
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <ShieldAlert className="w-12 h-12 text-amber-500 mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Access Denied
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    You don't have permission to view audit logs. Only organization administrators or superadmins can access this page.
                  </p>
                </div>
              ) : data?.items?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No audit logs found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Path</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IP</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {data?.items?.map((log: AuditLogEntry) => (
                        <tr
                          key={log.id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 relative cursor-pointer ${selectedLog?.id === log.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                          onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                        >
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-800'}>
                              {log.action}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              <span className="font-medium">{entityTypeLabels[log.entityType] || log.entityType}</span>
                              <span className="text-muted-foreground ml-1 font-mono text-xs">{log.entityId.substring(0, 8)}...</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              <div>{log.userEmail || 'System'}</div>
                              {log.userRole && (
                                <div className="text-xs text-muted-foreground">{log.userRole}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-xs max-w-[200px] truncate" title={log.path}>
                            {log.method} {log.path}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                            {log.ipAddress || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                            {log.executionTimeMs ? `${log.executionTimeMs}ms` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {data && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.total)} of {data.total} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm">Page {page}</span>
                <Button
                  variant="secondary"
                  onClick={() => setPage(page + 1)}
                  disabled={page * limit >= data.total}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Detail Panel */}
        {selectedLog && (
          <div className="w-1/2">
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 sticky top-6">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Log Details
                    <Badge className="ml-2" variant="outline">
                      {selectedLog.action}
                    </Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Left Column - Basic Info */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Log ID</label>
                      <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mt-1 break-all">{selectedLog.id}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Entity</label>
                      <p className="text-sm mt-1">
                        {entityTypeLabels[selectedLog.entityType] || selectedLog.entityType} - ID: <span className="font-mono text-xs">{selectedLog.entityId}</span>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Method & Path</label>
                      <p className="text-sm font-mono mt-1">{selectedLog.method} {selectedLog.path}</p>
                    </div>
                  </div>

                  {/* Right Column - User & Request Info */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">User</label>
                      <p className="text-sm mt-1">
                        {selectedLog.userEmail || 'System'}
                        {selectedLog.userRole && (
                          <span className="text-muted-foreground ml-2">({selectedLog.userRole})</span>
                        )}
                      </p>
                      {selectedLog.userId && (
                        <p className="text-xs text-muted-foreground font-mono mt-1">ID: {selectedLog.userId}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Organization</label>
                      <p className="text-sm font-mono mt-1">{selectedLog.organizationId || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Status Code</label>
                      <p className="text-sm mt-1">
                        {selectedLog.statusCode && (
                          <Badge variant={selectedLog.statusCode >= 400 ? 'destructive' : 'default'}>
                            {selectedLog.statusCode}
                          </Badge>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">Execution Time</label>
                      <p className="text-sm mt-1">
                        {selectedLog.executionTimeMs ? `${selectedLog.executionTimeMs}ms` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Changes Section */}
                {selectedLog.changes && (
                  <div className="mt-4 pt-4 border-t">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Changes</label>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded mt-2 overflow-auto max-h-48">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Metadata Section */}
                {selectedLog.metadata && (
                  <div className="mt-4 pt-4 border-t">
                    <label className="text-xs font-medium text-muted-foreground uppercase">Metadata</label>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded mt-2 overflow-auto max-h-48">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Request Info */}
                <div className="mt-4 pt-4 border-t grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">IP Address</label>
                    <p className="text-sm font-mono mt-1">{selectedLog.ipAddress || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">User Agent</label>
                    <p className="text-sm truncate mt-1" title={selectedLog.userAgent || 'N/A'}>
                      {selectedLog.userAgent || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="mt-4 pt-4 border-t">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Created At</label>
                  <p className="text-sm mt-1">{format(new Date(selectedLog.createdAt), 'MMMM d, yyyy HH:mm:ss.SSS')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}