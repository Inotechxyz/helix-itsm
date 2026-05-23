import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { assetsApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Search, Plus, Monitor, Server, Cloud, Wifi, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ModuleErrorHandler } from '../hooks/useModuleGuard';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'retired', label: 'Retired' },
  { value: 'disposed', label: 'Disposed' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'inactive':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    case 'under_maintenance':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'retired':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'disposed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getTypeIcon = (typeName: string) => {
  const name = typeName?.toLowerCase() || '';
  if (name.includes('hardware') || name.includes('computer') || name.includes('laptop')) {
    return <Monitor className="w-4 h-4" />;
  }
  if (name.includes('server')) {
    return <Server className="w-4 h-4" />;
  }
  if (name.includes('cloud')) {
    return <Cloud className="w-4 h-4" />;
  }
  if (name.includes('network')) {
    return <Wifi className="w-4 h-4" />;
  }
  return <Package className="w-4 h-4" />;
};

export function AssetsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [typeId, setTypeId] = useState('');

  const { data: typesData } = useQuery({
    queryKey: ['asset-types'],
    queryFn: () => assetsApi.types.list().then((r) => r.data),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', page, search, status, typeId],
    queryFn: () =>
      assetsApi
        .list({
          page,
          limit: 20,
          search: search || undefined,
          status: status ? [status] : undefined,
          typeId: typeId || undefined,
        })
        .then((r) => r.data),
    retry: false,
  });

  return (
    <ModuleErrorHandler error={error} moduleName="Assets">
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-muted-foreground">Manage IT configuration items and equipment</p>
        </div>
        <Link to="/assets/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{data?.total ?? 0}</div>
            <p className="text-sm text-muted-foreground">Total Assets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {data?.items?.filter((a: any) => a.status === 'active').length ?? 0}
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {data?.items?.filter((a: any) => a.status === 'under_maintenance').length ?? 0}
            </div>
            <p className="text-sm text-muted-foreground">Under Maintenance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {data?.items?.filter((a: any) => a.status === 'retired' || a.status === 'disposed').length ?? 0}
            </div>
            <p className="text-sm text-muted-foreground">Retired/Disposed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search assets (name, tag, serial, IP...)"
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
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background"
            >
              <option value="">All Types</option>
              {typesData?.map((type: any) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Assets List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : data?.items?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No assets found
            </div>
          ) : (
            <div className="divide-y">
              {data?.items?.map((asset: any) => (
                <Link
                  key={asset.id}
                  to={`/assets/${asset.id}`}
                  className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                    {getTypeIcon(asset.type?.name)}
                  </div>
                  <div className="flex-1 min-w-0 ml-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-muted-foreground">
                        {asset.assetTag}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(asset.status)}`}>
                        {asset.status?.replace('_', ' ')}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                        {asset.type?.name}
                      </span>
                    </div>
                    <p className="font-medium truncate">{asset.name}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {asset.serialNumber && <span>S/N: {asset.serialNumber}</span>}
                      {asset.assignedTo && (
                        <span>Assigned: {asset.assignedTo.firstName} {asset.assignedTo.lastName}</span>
                      )}
                      {asset.location && <span>{asset.location}</span>}
                      <span>{format(new Date(asset.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {asset._count?.relationshipsFrom > 0 && (
                      <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                        {asset._count.relationshipsFrom} links
                      </span>
                    )}
                    {asset._count?.maintenanceRecords > 0 && (
                      <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                        {asset._count.maintenanceRecords} maintenance
                      </span>
                    )}
                    {asset._count?.tickets > 0 && (
                      <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                        {asset._count.tickets} tickets
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total} results
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
    </ModuleErrorHandler>
  );
}
