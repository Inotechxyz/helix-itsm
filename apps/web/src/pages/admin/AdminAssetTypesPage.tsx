import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Tooltip } from '../../components/ui/Tooltip';
import { Plus, Edit, Trash2, Monitor, Server, Cloud, Wifi, Package } from 'lucide-react';
import { toast } from 'sonner';

const iconOptions = [
  { value: 'monitor', label: 'Monitor/Computer', Icon: Monitor },
  { value: 'server', label: 'Server', Icon: Server },
  { value: 'cloud', label: 'Cloud', Icon: Cloud },
  { value: 'wifi', label: 'Network', Icon: Wifi },
  { value: 'package', label: 'Other', Icon: Package },
];

const colorOptions = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

export function AdminAssetTypesPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'package',
    color: '#6366f1',
  });

  const { data: types, isLoading } = useQuery({
    queryKey: ['asset-types', organizationId],
    queryFn: () => assetsApi.types.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => assetsApi.types.create(data),
    onSuccess: () => {
      toast.success('Asset type created successfully');
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      closeModal();
    },
    onError: () => {
      toast.error('Failed to create asset type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => assetsApi.types.update(id, data),
    onSuccess: () => {
      toast.success('Asset type updated successfully');
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      closeModal();
    },
    onError: () => {
      toast.error('Failed to update asset type');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assetsApi.types.delete(id),
    onSuccess: () => {
      toast.success('Asset type deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete asset type');
    },
  });

  const openModal = (type?: any) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description || '',
        icon: type.icon || 'package',
        color: type.color || '#6366f1',
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        description: '',
        icon: 'package',
        color: '#6366f1',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingType(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = iconOptions.find((i) => i.value === iconName)?.Icon || Package;
    return <IconComponent className="w-5 h-5" />;
  };

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Asset Types</h1>
          <p className="text-muted-foreground">Manage configuration item categories</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Type
        </Button>
      </div>

      {/* Types List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : types?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No asset types found. Create your first type to get started.
            </div>
          ) : (
            <div className="divide-y">
              {types?.map((type: any) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${type.color}20`, color: type.color }}
                    >
                      {getIconComponent(type.icon)}
                    </div>
                    <div>
                      <p className="font-medium">{type.name}</p>
                      {type.description && (
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {type._count?.assets || 0} assets
                    </span>
                    <Tooltip content="Edit">
                      <Button variant="ghost" size="icon" onClick={() => openModal(type)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this type?')) {
                            deleteMutation.mutate(type.id);
                          }
                        }}
                        disabled={type._count?.assets > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingType ? 'Edit Asset Type' : 'Add Asset Type'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Laptop, Server, Cloud Resource"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this type"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Icon</label>
            <div className="flex gap-2">
              {iconOptions.map((option) => {
                const IconComp = option.Icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, icon: option.value }))}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition ${
                      formData.icon === option.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                    title={option.label}
                  >
                    <IconComp className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <div className="flex gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-lg border-2 transition ${
                    formData.color === color
                      ? 'border-gray-900 dark:border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="pt-4 border-t">
            <label className="block text-sm font-medium mb-2">Preview</label>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${formData.color}20`, color: formData.color }}
              >
                {getIconComponent(formData.icon)}
              </div>
              <div>
                <p className="font-medium">{formData.name || 'Type Name'}</p>
                {formData.description && (
                  <p className="text-sm text-muted-foreground">{formData.description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingType ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
