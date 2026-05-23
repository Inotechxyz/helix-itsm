import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceCatalogApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Tooltip } from '../../components/ui/Tooltip';
import { Layers, Plus, Edit2, Trash2 } from 'lucide-react';
import { showToast } from '../../components/ui/Toast';

export function AdminServiceCategoriesPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '',
    color: '#6366f1',
    sortOrder: 0,
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-service-categories', organizationId],
    queryFn: () => serviceCatalogApi.categories.list().then((r) => r.data),
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => serviceCatalogApi.categories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      showToast('Category created successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to create category', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => serviceCatalogApi.categories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      showToast('Category updated successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to update category', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => serviceCatalogApi.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });
      showToast('Category deleted successfully', 'success');
    },
    onError: (error: any) => showToast(error.response?.data?.message || 'Failed to delete category', 'error'),
  });

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '',
      color: '#6366f1',
      sortOrder: 0,
    });
    setShowModal(true);
  };

  const openEditModal = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug || '',
      description: category.description || '',
      icon: category.icon || '',
      color: category.color || '#6366f1',
      sortOrder: category.sortOrder || 0,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { ...formData };
    if (!data.description) delete data.description;
    if (!data.icon) delete data.icon;
    if (!data.slug) delete data.slug;

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Service Categories</h1>
          <p className="text-muted-foreground">Manage service catalog categories</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : categories?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No categories found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories?.map((category: any) => (
            <Card key={category.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: category.color || '#6366f1' }}
                    >
                      <Layers className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{category.name}</h3>
                      <Badge variant="outline">{category._count?.services || 0} services</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Tooltip content="Edit">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(category)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this category?')) {
                            deleteMutation.mutate(category.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                {category.description && (
                  <p className="mt-3 text-sm text-muted-foreground">{category.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editingCategory ? 'Edit Category' : 'Create Category'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Slug (optional)"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="auto-generated-from-name"
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Input
            label="Icon (optional)"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            placeholder="e.g., Briefcase, Wrench"
          />
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full h-10 rounded-md border cursor-pointer"
            />
          </div>
          <Input
            label="Sort Order"
            type="number"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
