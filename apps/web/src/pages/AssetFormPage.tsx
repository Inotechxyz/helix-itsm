import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { assetsApi, usersApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Tooltip } from '../components/ui/Tooltip';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export function AssetFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    assetTag: '',
    serialNumber: '',
    typeId: '',
    status: 'active',
    manufacturer: '',
    model: '',
    version: '',
    vendor: '',
    purchaseDate: '',
    purchaseCost: '',
    warrantyExpiry: '',
    location: '',
    department: '',
    assignedToId: '',
    ipAddress: '',
    macAddress: '',
    hostname: '',
    operatingSystem: '',
    cpu: '',
    ram: '',
    storage: '',
    notes: '',
  });

  const { data: typesData } = useQuery({
    queryKey: ['asset-types'],
    queryFn: () => assetsApi.types.list().then((r) => r.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 100 }).then((r) => r.data),
  });

  const { data: assetData, isLoading: isLoadingAsset } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (assetData) {
      setFormData({
        name: assetData.name || '',
        assetTag: assetData.assetTag || '',
        serialNumber: assetData.serialNumber || '',
        typeId: assetData.typeId || '',
        status: assetData.status || 'active',
        manufacturer: assetData.manufacturer || '',
        model: assetData.model || '',
        version: assetData.version || '',
        vendor: assetData.vendor || '',
        purchaseDate: assetData.purchaseDate ? assetData.purchaseDate.split('T')[0] : '',
        purchaseCost: assetData.purchaseCost || '',
        warrantyExpiry: assetData.warrantyExpiry ? assetData.warrantyExpiry.split('T')[0] : '',
        location: assetData.location || '',
        department: assetData.department || '',
        assignedToId: assetData.assignedToId || '',
        ipAddress: assetData.ipAddress || '',
        macAddress: assetData.macAddress || '',
        hostname: assetData.hostname || '',
        operatingSystem: assetData.operatingSystem || '',
        cpu: assetData.cpu || '',
        ram: assetData.ram || '',
        storage: assetData.storage || '',
        notes: assetData.notes || '',
      });
    }
  }, [assetData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => assetsApi.create(data),
    onSuccess: () => {
      toast.success('Asset created successfully');
      navigate('/app/assets');
    },
    onError: () => {
      toast.error('Failed to create asset');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => assetsApi.update(id!, data),
    onSuccess: () => {
      toast.success('Asset updated successfully');
      navigate(`/assets/${id}`);
    },
    onError: () => {
      toast.error('Failed to update asset');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : undefined,
      purchaseDate: formData.purchaseDate || undefined,
      warrantyExpiry: formData.warrantyExpiry || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isEditing && isLoadingAsset) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Tooltip content="Back">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Tooltip>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update asset information' : 'Add a new configuration item'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Asset Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Dell Laptop XPS 15"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Asset Tag</label>
                <Input
                  value={formData.assetTag}
                  onChange={(e) => handleChange('assetTag', e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.typeId}
                  onChange={(e) => handleChange('typeId', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background"
                  required
                >
                  <option value="">Select type</option>
                  {typesData?.map((type: any) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="under_maintenance">Under Maintenance</option>
                  <option value="retired">Retired</option>
                  <option value="disposed">Disposed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Serial Number</label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => handleChange('serialNumber', e.target.value)}
                  placeholder="e.g., SN12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Assigned To</label>
                <select
                  value={formData.assignedToId}
                  onChange={(e) => handleChange('assignedToId', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background"
                >
                  <option value="">Unassigned</option>
                  {usersData?.items?.map((user: any) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hardware Details */}
        <Card>
          <CardHeader>
            <CardTitle>Hardware Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Manufacturer</label>
                <Input
                  value={formData.manufacturer}
                  onChange={(e) => handleChange('manufacturer', e.target.value)}
                  placeholder="e.g., Dell, HP, Lenovo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <Input
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  placeholder="e.g., XPS 15, ThinkPad X1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Version</label>
                <Input
                  value={formData.version}
                  onChange={(e) => handleChange('version', e.target.value)}
                  placeholder="e.g., v2.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vendor</label>
                <Input
                  value={formData.vendor}
                  onChange={(e) => handleChange('vendor', e.target.value)}
                  placeholder="e.g., CDW, Dell Direct"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Operating System</label>
                <Input
                  value={formData.operatingSystem}
                  onChange={(e) => handleChange('operatingSystem', e.target.value)}
                  placeholder="e.g., Windows 11 Pro"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">CPU</label>
                <Input
                  value={formData.cpu}
                  onChange={(e) => handleChange('cpu', e.target.value)}
                  placeholder="e.g., Intel i7-12700H"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">RAM</label>
                <Input
                  value={formData.ram}
                  onChange={(e) => handleChange('ram', e.target.value)}
                  placeholder="e.g., 32GB DDR5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Storage</label>
                <Input
                  value={formData.storage}
                  onChange={(e) => handleChange('storage', e.target.value)}
                  placeholder="e.g., 512GB NVMe SSD"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Network Information */}
        <Card>
          <CardHeader>
            <CardTitle>Network Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hostname</label>
                <Input
                  value={formData.hostname}
                  onChange={(e) => handleChange('hostname', e.target.value)}
                  placeholder="e.g., WORKSTATION-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">IP Address</label>
                <Input
                  value={formData.ipAddress}
                  onChange={(e) => handleChange('ipAddress', e.target.value)}
                  placeholder="e.g., 192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">MAC Address</label>
                <Input
                  value={formData.macAddress}
                  onChange={(e) => handleChange('macAddress', e.target.value)}
                  placeholder="e.g., AA:BB:CC:DD:EE:FF"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Financial */}
        <Card>
          <CardHeader>
            <CardTitle>Location & Financial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <Input
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="e.g., Building A, Floor 3, Room 301"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <Input
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  placeholder="e.g., Engineering, Sales"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Purchase Date</label>
                <Input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => handleChange('purchaseDate', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Purchase Cost</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.purchaseCost}
                  onChange={(e) => handleChange('purchaseCost', e.target.value)}
                  placeholder="e.g., 1299.99"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Warranty Expiry</label>
                <Input
                  type="date"
                  value={formData.warrantyExpiry}
                  onChange={(e) => handleChange('warrantyExpiry', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes or comments..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Update Asset' : 'Create Asset'}
          </Button>
        </div>
      </form>
    </div>
    </div>
  );
}
