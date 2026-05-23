import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, teamsApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Tooltip } from '../../components/ui/Tooltip';
import { FolderTree, Plus, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { showToast } from '../../components/ui/Toast';

export function AdminTicketCategoriesPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sortOrder: 0,
    parentId: '',
    defaultTeamId: '',
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-ticket-categories', organizationId],
    queryFn: () => categoriesApi.tree({ organizationId }).then((r) => r.data),
    enabled: !!organizationId,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams', organizationId],
    queryFn: () => teamsApi.list({ organizationId }).then((r) => r.data),
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => categoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-categories'] });
      showToast('Category created successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to create category', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => categoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-categories'] });
      showToast('Category updated successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to update category', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-categories'] });
      showToast('Category deleted successfully', 'success');
    },
    onError: () => showToast('Failed to delete category', 'error'),
  });

  const openCreateModal = (parentId?: string) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      sortOrder: 0,
      parentId: parentId || '',
      defaultTeamId: '',
    });
    setShowModal(true);
  };

  const openEditModal = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      sortOrder: category.sortOrder || 0,
      parentId: category.parentId || '',
      defaultTeamId: category.defaultTeam?.id || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, any> = { ...formData };
    if (!data.parentId) delete data.parentId;
    if (!data.defaultTeamId) delete data.defaultTeamId;
    if (!data.description) delete data.description;

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const renderCategory = (category: any, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedIds.has(category.id);

    return (
      <div key={category.id}>
        <div
          className="flex items-center justify-between p-3 hover:bg-gray-50 border-b"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                onClick={() => toggleExpand(category.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
            )}
            {!hasChildren && <div className="w-6" />}
            <FolderTree className="w-5 h-5 text-muted-foreground" />
            <div>
              <span className="font-medium">{category.name}</span>
              {category.description && (
                <span className="ml-2 text-sm text-muted-foreground">{category.description}</span>
              )}
            </div>
            {category.defaultTeam && (
              <Badge variant="outline" className="ml-2">{category.defaultTeam.name}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip content="Add Subcategory">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCreateModal(category.id)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </Tooltip>
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
        {hasChildren && isExpanded && (
          <div className="bg-gray-50">
            {category.children.map((child: any) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ticket Categories</h1>
          <p className="text-muted-foreground">Manage ticket categorization hierarchy</p>
        </div>
        <Button onClick={() => openCreateModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded" />
              ))}
            </div>
          </CardContent>
        ) : !categories || categories.length === 0 ? (
          <CardContent className="p-8 text-center">
            <FolderTree className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No categories found</p>
          </CardContent>
        ) : (
          <div className="divide-y">{categories.map((cat: any) => renderCategory(cat))}</div>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editingCategory ? 'Edit Category' : 'Create Category'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Input
            label="Sort Order"
            type="number"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
          />
          <div>
            <label className="block text-sm font-medium mb-2">Parent Category</label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
            >
              <option value="">None (Top Level)</option>
              {categories?.flatMap((cat: any) => {
                const flatten = (c: any): any[] => {
                  if (c.id === editingCategory?.id) return [];
                  return [{ id: c.id, name: c.name }, ...(c.children?.flatMap(flatten) || [])];
                };
                return flatten(cat);
              }).map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Default Team</label>
            <select
              value={formData.defaultTeamId}
              onChange={(e) => setFormData({ ...formData, defaultTeamId: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
            >
              <option value="">None</option>
              {teams?.map((team: any) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
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
