import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { assetsApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Tooltip } from '../components/ui/Tooltip';
import {
  ArrowLeft, Edit, Trash2, Server, Monitor, Cloud, Wifi, Package,
  MapPin, User, Calendar, Network, AlertTriangle, Wrench, Link as LinkIcon,
  Plus, X, MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { MaintenanceForm } from '../components/assets/MaintenanceForm';
import { RelationshipForm } from '../components/assets/RelationshipForm';

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
    return <Monitor className="w-6 h-6" />;
  }
  if (name.includes('server')) {
    return <Server className="w-6 h-6" />;
  }
  if (name.includes('cloud')) {
    return <Cloud className="w-6 h-6" />;
  }
  if (name.includes('network')) {
    return <Wifi className="w-6 h-6" />;
  }
  return <Package className="w-6 h-6" />;
};

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<any>(null);
  const [editingRelationship, setEditingRelationship] = useState<any>(null);
  const [showMaintenanceMenu, setShowMaintenanceMenu] = useState<string | null>(null);
  const [showRelationshipMenu, setShowRelationshipMenu] = useState<string | null>(null);

  const { data: asset, isLoading, refetch } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => assetsApi.delete(id!),
    onSuccess: () => {
      navigate('/assets');
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: (relationshipId: string) => assetsApi.relationships.delete(relationshipId),
    onSuccess: () => {
      toast.success('Relationship deleted');
      refetch();
      setShowRelationshipMenu(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete relationship');
    },
  });

  const deleteMaintenanceMutation = useMutation({
    mutationFn: (maintenanceId: string) => assetsApi.maintenance.delete(maintenanceId),
    onSuccess: () => {
      toast.success('Maintenance record deleted');
      refetch();
      setShowMaintenanceMenu(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete maintenance record');
    },
  });

  const getRelationshipIcon = (type: string) => {
    switch (type) {
      case 'hosts': return <Server className="w-4 h-4 text-purple-500" />;
      case 'depends_on': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'connects_to': return <Network className="w-4 h-4 text-blue-500" />;
      case 'supports': return <Package className="w-4 h-4 text-green-500" />;
      default: return <LinkIcon className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Asset not found</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Tooltip content="Back">
            <Button variant="ghost" size="icon" onClick={() => navigate('/assets')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Tooltip>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              {getTypeIcon(asset.type?.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{asset.name}</h1>
                <span className={`px-2 py-0.5 rounded text-sm font-medium ${getStatusColor(asset.status)}`}>
                  {asset.status?.replace('_', ' ')}
                </span>
              </div>
              <p className="text-muted-foreground font-mono">{asset.assetTag}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/assets/${id}/edit`}>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card className="border-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-red-600">Delete Asset</h3>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete this asset? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Type</label>
                  <p className="font-medium">{asset.type?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Serial Number</label>
                  <p className="font-medium font-mono">{asset.serialNumber || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Manufacturer</label>
                  <p className="font-medium">{asset.manufacturer || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Model</label>
                  <p className="font-medium">{asset.model || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Version</label>
                  <p className="font-medium">{asset.version || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Vendor</label>
                  <p className="font-medium">{asset.vendor || 'N/A'}</p>
                </div>
              </div>

              {asset.operatingSystem && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">System Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">OS</label>
                      <p className="font-medium">{asset.operatingSystem}</p>
                    </div>
                    {asset.cpu && (
                      <div>
                        <label className="text-sm text-muted-foreground">CPU</label>
                        <p className="font-medium">{asset.cpu}</p>
                      </div>
                    )}
                    {asset.ram && (
                      <div>
                        <label className="text-sm text-muted-foreground">RAM</label>
                        <p className="font-medium">{asset.ram}</p>
                      </div>
                    )}
                    {asset.storage && (
                      <div>
                        <label className="text-sm text-muted-foreground">Storage</label>
                        <p className="font-medium">{asset.storage}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {asset.notes && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Notes</h4>
                  <p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relationships */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  Relationships
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddRelationship(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {asset.relationshipsFrom?.length === 0 && asset.relationshipsTo?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No relationships configured</p>
              ) : (
                <div className="space-y-4">
                  {/* Assets this asset hosts/supports */}
                  {asset.relationshipsFrom?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">This asset {getRelationshipVerb(asset.relationshipsFrom[0]?.type)}:</h4>
                      <div className="space-y-2">
                        {asset.relationshipsFrom.map((rel: any) => (
                          <div
                            key={rel.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 group"
                          >
                            {getRelationshipIcon(rel.type)}
                            <Link to={`/assets/${rel.toAsset.id}`} className="flex-1">
                              <p className="font-medium">{rel.toAsset.name}</p>
                              <p className="text-sm text-muted-foreground font-mono">{rel.toAsset.assetTag}</p>
                            </Link>
                            <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600">
                              {rel.type?.replace('_', ' ')}
                            </span>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowRelationshipMenu(showRelationshipMenu === rel.id ? null : rel.id)}
                                className="opacity-0 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                              {showRelationshipMenu === rel.id && (
                                <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border rounded-lg shadow-lg py-1 min-w-[120px]">
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    onClick={() => {
                                      setEditingRelationship(rel);
                                      setShowRelationshipMenu(null);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                  </button>
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 flex items-center gap-2"
                                    onClick={() => deleteRelationshipMutation.mutate(rel.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assets this asset depends on */}
                  {asset.relationshipsTo?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Depends on:</h4>
                      <div className="space-y-2">
                        {asset.relationshipsTo.map((rel: any) => (
                          <div
                            key={rel.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 group"
                          >
                            {getRelationshipIcon(rel.type)}
                            <Link to={`/assets/${rel.fromAsset.id}`} className="flex-1">
                              <p className="font-medium">{rel.fromAsset.name}</p>
                              <p className="text-sm text-muted-foreground font-mono">{rel.fromAsset.assetTag}</p>
                            </Link>
                            <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600">
                              {rel.type?.replace('_', ' ')}
                            </span>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowRelationshipMenu(showRelationshipMenu === rel.id ? null : rel.id)}
                                className="opacity-0 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                              {showRelationshipMenu === rel.id && (
                                <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border rounded-lg shadow-lg py-1 min-w-[120px]">
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    onClick={() => {
                                      setEditingRelationship(rel);
                                      setShowRelationshipMenu(null);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                  </button>
                                  <button
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 flex items-center gap-2"
                                    onClick={() => deleteRelationshipMutation.mutate(rel.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Child Assets */}
          {asset.childAssets?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Child Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {asset.childAssets.map((child: any) => (
                    <Link
                      key={child.id}
                      to={`/assets/${child.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        {getTypeIcon(child.type?.name)}
                        <div>
                          <p className="font-medium">{child.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{child.assetTag}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(child.status)}`}>
                        {child.status}
                      </span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Maintenance Records */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Maintenance History
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddMaintenance(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {asset.maintenanceRecords?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No maintenance records</p>
              ) : (
                <div className="space-y-3">
                  {asset.maintenanceRecords.map((record: any) => (
                    <div key={record.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{record.title}</p>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600">
                            {record.type}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            record.status === 'completed' ? 'bg-green-100 text-green-800' :
                            record.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            record.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {record.status?.replace('_', ' ')}
                          </span>
                        </div>
                        {record.description && (
                          <p className="text-sm text-muted-foreground mt-1">{record.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {record.performedBy && <span>By: {record.performedBy}</span>}
                          {record.performedAt && <span>Date: {format(new Date(record.performedAt), 'MMM d, yyyy')}</span>}
                          {record.cost && <span>Cost: ${record.cost}</span>}
                        </div>
                      </div>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowMaintenanceMenu(showMaintenanceMenu === record.id ? null : record.id)}
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                        {showMaintenanceMenu === record.id && (
                          <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border rounded-lg shadow-lg py-1 min-w-[120px]">
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => {
                                setEditingMaintenance(record);
                                setShowMaintenanceMenu(null);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 flex items-center gap-2"
                              onClick={() => deleteMaintenanceMutation.mutate(record.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Tickets */}
          {asset.tickets?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Linked Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {asset.tickets.map((link: any) => (
                    <Link
                      key={link.id}
                      to={`/tickets/${link.ticket.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <div>
                        <p className="font-medium font-mono">{link.ticket.ticketNumber}</p>
                        <p className="text-sm text-muted-foreground">{link.ticket.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          link.ticket.status === 'resolved' || link.ticket.status === 'closed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {link.ticket.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Current Status</label>
                  <p className={`inline-block px-2 py-1 rounded font-medium ${getStatusColor(asset.status)}`}>
                    {asset.status?.replace('_', ' ')}
                  </p>
                </div>
                {asset.warrantyExpiry && (
                  <div>
                    <label className="text-sm text-muted-foreground">Warranty Expiry</label>
                    <p className={`font-medium ${
                      new Date(asset.warrantyExpiry) < new Date()
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {format(new Date(asset.warrantyExpiry), 'MMMM d, yyyy')}
                    </p>
                  </div>
                )}
                {asset.purchaseDate && (
                  <div>
                    <label className="text-sm text-muted-foreground">Purchase Date</label>
                    <p className="font-medium">
                      {format(new Date(asset.purchaseDate), 'MMMM d, yyyy')}
                    </p>
                  </div>
                )}
                {asset.purchaseCost && (
                  <div>
                    <label className="text-sm text-muted-foreground">Purchase Cost</label>
                    <p className="font-medium">${asset.purchaseCost}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location & Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Location & Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {asset.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <label className="text-sm text-muted-foreground">Location</label>
                      <p className="font-medium">{asset.location}</p>
                    </div>
                  </div>
                )}
                {asset.department && (
                  <div>
                    <label className="text-sm text-muted-foreground">Department</label>
                    <p className="font-medium">{asset.department}</p>
                  </div>
                )}
                {asset.assignedTo && (
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <label className="text-sm text-muted-foreground">Assigned To</label>
                      <p className="font-medium">
                        {asset.assignedTo.firstName} {asset.assignedTo.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{asset.assignedTo.email}</p>
                    </div>
                  </div>
                )}
                {!asset.location && !asset.department && !asset.assignedTo && (
                  <p className="text-muted-foreground text-sm">Not assigned</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Network Info */}
          {(asset.ipAddress || asset.macAddress || asset.hostname) && (
            <Card>
              <CardHeader>
                <CardTitle>Network</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {asset.hostname && (
                    <div>
                      <label className="text-sm text-muted-foreground">Hostname</label>
                      <p className="font-medium font-mono">{asset.hostname}</p>
                    </div>
                  )}
                  {asset.ipAddress && (
                    <div>
                      <label className="text-sm text-muted-foreground">IP Address</label>
                      <p className="font-medium font-mono">{asset.ipAddress}</p>
                    </div>
                  )}
                  {asset.macAddress && (
                    <div>
                      <label className="text-sm text-muted-foreground">MAC Address</label>
                      <p className="font-medium font-mono">{asset.macAddress}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm text-muted-foreground">Created</label>
                    <p className="font-medium">{format(new Date(asset.createdAt), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Last Updated</label>
                  <p className="font-medium">{format(new Date(asset.updatedAt), 'MMM d, yyyy HH:mm')}</p>
                </div>
                {asset.lastInventoryAt && (
                  <div>
                    <label className="text-sm text-muted-foreground">Last Inventory</label>
                    <p className="font-medium">{format(new Date(asset.lastInventoryAt), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {showAddMaintenance && (
        <MaintenanceForm
          isOpen={showAddMaintenance}
          onClose={() => {
            setShowAddMaintenance(false);
            setEditingMaintenance(null);
          }}
          onSuccess={() => refetch()}
          assetId={id!}
        />
      )}

      {editingMaintenance && (
        <MaintenanceForm
          isOpen={true}
          onClose={() => {
            setEditingMaintenance(null);
          }}
          onSuccess={() => refetch()}
          assetId={id!}
          maintenance={editingMaintenance}
        />
      )}

      {showAddRelationship && (
        <RelationshipForm
          isOpen={showAddRelationship}
          onClose={() => {
            setShowAddRelationship(false);
            setEditingRelationship(null);
          }}
          onSuccess={() => refetch()}
          currentAssetId={id!}
        />
      )}

      {editingRelationship && (
        <RelationshipForm
          isOpen={true}
          onClose={() => {
            setEditingRelationship(null);
          }}
          onSuccess={() => refetch()}
          currentAssetId={id!}
          relationship={editingRelationship}
        />
      )}
    </div>
  );
}

function getRelationshipVerb(type: string): string {
  switch (type) {
    case 'hosts': return 'hosts';
    case 'supports': return 'supports';
    case 'connects_to': return 'connects to';
    case 'runs_on': return 'runs on';
    case 'backup_of': return 'is backup of';
    case 'replicated_to': return 'replicates to';
    default: return 'links to';
  }
}
