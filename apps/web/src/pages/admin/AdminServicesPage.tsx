import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serviceCatalogApi, teamsApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Tooltip } from '../../components/ui/Tooltip';
import { Briefcase, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { showToast } from '../../components/ui/Toast';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  draft: 'bg-yellow-100 text-yellow-800',
  retired: 'bg-red-100 text-red-800',
};

export function AdminServicesPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [filter, setFilter] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shortDescription: '',
    categoryId: '',
    price: 0,
    deliveryTimeDays: 1,
    requiresApproval: false,
    autoFulfill: false,
    slaHours: 0,
    instructions: '',
    assignedTeamId: '',
  });

  const { data: servicesData, isLoading } = useQuery({
    queryKey: ['admin-services', organizationId, filter],
    queryFn: () => {
      // Only pass status if filter is not empty
      const params: any = { organizationId };
      if (filter) {
        params.status = filter;
      }
      return serviceCatalogApi.services.list(params).then((r) => r.data);
    },
    enabled: !!organizationId,
  });

  const services = servicesData;

  const { data: categories } = useQuery({
    queryKey: ['service-categories', organizationId],
    queryFn: () => serviceCatalogApi.categories.list({ organizationId }).then((r) => r.data),
    enabled: !!organizationId,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams', organizationId],
    queryFn: () => teamsApi.list({ organizationId }).then((r) => r.data),
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => serviceCatalogApi.services.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      showToast('Service created successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to create service', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => serviceCatalogApi.services.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      showToast('Service updated successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to update service', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => serviceCatalogApi.services.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      showToast('Service retired successfully', 'success');
    },
    onError: () => showToast('Failed to retire service', 'error'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => serviceCatalogApi.services.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] });
      showToast('Service activated successfully', 'success');
    },
    onError: () => showToast('Failed to activate service', 'error'),
  });

  const openCreateModal = () => {
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      shortDescription: '',
      categoryId: '',
      price: 0,
      deliveryTimeDays: 1,
      requiresApproval: false,
      autoFulfill: false,
      slaHours: 0,
      instructions: '',
      assignedTeamId: '',
    });
    setShowModal(true);
  };

  const openEditModal = (service: any) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      shortDescription: service.shortDescription || '',
      categoryId: service.categoryId || '',
      price: service.price || 0,
      deliveryTimeDays: service.deliveryTimeDays || 1,
      requiresApproval: service.requiresApproval || false,
      autoFulfill: service.autoFulfill || false,
      slaHours: service.slaHours || 0,
      instructions: service.instructions || '',
      assignedTeamId: service.assignedTeam?.id || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingService(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { ...formData };
    if (!data.description) delete data.description;
    if (!data.shortDescription) delete data.shortDescription;
    if (!data.categoryId) delete data.categoryId;
    if (!data.assignedTeamId) delete data.assignedTeamId;
    if (!data.instructions) delete data.instructions;

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage service catalog services</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            {['', 'active', 'inactive', 'draft'].map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {status === '' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : services?.items?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No services found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {services?.items?.map((service: any) => (
            <Card key={service.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[service.status] || ''}`}>
                        {service.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {service.status === 'active' ? (
                      <Tooltip content="Deactivate">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(service.id)}
                        >
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip content="Activate">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => activateMutation.mutate(service.id)}
                        >
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content="Edit">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(service)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                {service.shortDescription && (
                  <p className="text-sm text-muted-foreground mb-3">{service.shortDescription}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {service.category && (
                    <Badge variant="outline">{service.category.name}</Badge>
                  )}
                  {service.price > 0 && (
                    <Badge variant="outline">${service.price}</Badge>
                  )}
                  {service.deliveryTimeDays && (
                    <Badge variant="outline">{service.deliveryTimeDays} days</Badge>
                  )}
                  {service.requiresApproval && (
                    <Badge variant="secondary">Requires Approval</Badge>
                  )}
                </div>

                {service.assignedTeam && (
                  <div className="text-sm text-muted-foreground">
                    Team: {service.assignedTeam.name}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editingService ? 'Edit Service' : 'Create Service'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Service Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Short Description"
            value={formData.shortDescription}
            onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium mb-2">Full Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-background"
              >
                <option value="">Select category...</option>
                {categories?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <Input
              label="Price ($)"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Delivery Time (days)"
              type="number"
              value={formData.deliveryTimeDays}
              onChange={(e) => setFormData({ ...formData, deliveryTimeDays: parseInt(e.target.value) || 1 })}
            />
            <Input
              label="SLA Hours"
              type="number"
              value={formData.slaHours}
              onChange={(e) => setFormData({ ...formData, slaHours: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Assigned Team</label>
              <select
                value={formData.assignedTeamId}
                onChange={(e) => setFormData({ ...formData, assignedTeamId: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-background"
              >
                <option value="">Select team...</option>
                {teams?.map((team: any) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requiresApproval}
                  onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Requires Approval</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.autoFulfill}
                  onChange={(e) => setFormData({ ...formData, autoFulfill: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Auto Fulfill</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Instructions</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
              rows={3}
              placeholder="Instructions for fulfilling this service..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingService ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
