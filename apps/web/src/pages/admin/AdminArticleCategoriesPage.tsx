import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kbApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Tooltip } from '../../components/ui/Tooltip';
import { FolderTree, Plus, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { showToast } from '../../components/ui/Toast';

export function AdminArticleCategoriesPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '',
    color: '#6366f1',
    sortOrder: 0,
    parentId: '',
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-article-categories', organizationId],
    queryFn: () => kbApi.categories.tree().then((r) => r.data),
    enabled: !!organizationId,
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.categories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-article-categories'] });
      showToast('Category created successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to create category', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => kbApi.categories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-article-categories'] });
      showToast('Category updated successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to update category', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => kbApi.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-article-categories'] });
      showToast('Category deleted successfully', 'success');
    },
    onError: (error: any) => showToast(error.response?.data?.message || 'Failed to delete category', 'error'),
  });

  const openCreateModal = (parentId?: string) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '',
      color: '#6366f1',
      sortOrder: 0,
      parentId: parentId || '',
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
      parentId: category.parentId || '',
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
    if (!data.parentId) delete data.parentId;
    if (!data.description) delete data.description;
    if (!data.icon) delete data.icon;
    if (!data.slug) delete data.slug;

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
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
                className="p-1 hover:bg-gray-200 rounded transition-transform"
              >
                <ChevronRight
                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>
            )}
            {!hasChildren && <div className="w-5" />}
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: category.color || '#6366f1' }}
            />
            <FolderTree className="w-5 h-5 text-muted-foreground" />
            <div>
              <span className="font-medium">{category.name}</span>
              {category.description && (
                <span className="ml-2 text-sm text-muted-foreground">{category.description}</span>
              )}
            </div>
            <Badge variant="outline">{category._count?.articles || 0} articles</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip content="Add Subcategory">
              <Button variant="ghost" size="sm" onClick={() => openCreateModal(category.id)}>
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

  // Flatten categories for parent selection (excluding current and descendants)
  const flattenCategories = (cats: any[], excludeId?: string, level = 0): any[] => {
    const result: any[] = [];
    for (const cat of cats) {
      if (cat.id !== excludeId) {
        result.push({ ...cat, level });
        if (cat.children) {
          result.push(...flattenCategories(cat.children, excludeId, level + 1));
        }
      }
    }
    return result;
  };

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Article Categories</h1>
          <p className="text-muted-foreground">Manage Knowledge Base article categories</p>
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
            placeholder="e.g., Book, HelpCircle"
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
          <div>
            <label className="block text-sm font-medium mb-2">Parent Category</label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
            >
              <option value="">None (Top Level)</option>
              {flattenCategories(categories || [], editingCategory?.id).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {'  '.repeat(cat.level)} {cat.name}
                </option>
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
