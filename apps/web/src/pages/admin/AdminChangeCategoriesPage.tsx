import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Tooltip } from '../../components/ui/Tooltip';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { changeCategoriesApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';

export function AdminChangeCategoriesPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-change-categories', organizationId],
    queryFn: () => changeCategoriesApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => changeCategoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-change-categories'] });
      toast.success('Category created successfully');
      closeModal();
    },
    onError: () => toast.error('Failed to create category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => changeCategoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-change-categories'] });
      toast.success('Category updated successfully');
      closeModal();
    },
    onError: () => toast.error('Failed to update category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => changeCategoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-change-categories'] });
      toast.success('Category deleted successfully');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to delete category'),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEditModal = (category: any) => {
    setEditingCategory(category);
    setForm({ name: category.name, description: category.description || '' });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setForm({ name: '', description: '' });
  };

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Change Categories</h1>
          <p className="text-muted-foreground">Manage change request categories</p>
        </div>
        <Button onClick={() => { setEditingCategory(null); setForm({ name: '', description: '' }); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !categories || categories.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No categories found. Create your first category.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {categories.map((category: any) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                    {category._count?.changes > 0 && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {category._count.changes} change(s)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Tooltip content="Edit">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(category)}>
                        <Edit className="w-4 h-4" />
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
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Hardware, Software, Network"
            required
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description of this category"
          />
        </div>
      </Modal>
    </div>
  );
}