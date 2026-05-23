import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { assetsApi } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { toast } from 'sonner';

interface MaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assetId: string;
  maintenance?: {
    id: string;
    title: string;
    type: string;
    description: string | null;
    performedBy: string | null;
    performedAt: string | null;
    nextDueDate: string | null;
    cost: number | null;
    status: string;
  };
}

export function MaintenanceForm({
  isOpen,
  onClose,
  onSuccess,
  assetId,
  maintenance,
}: MaintenanceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: maintenance?.title || '',
    type: maintenance?.type || 'preventive',
    status: maintenance?.status || 'scheduled',
    description: maintenance?.description || '',
    performedBy: maintenance?.performedBy || '',
    performedAt: maintenance?.performedAt?.split('T')[0] || '',
    nextDueDate: maintenance?.nextDueDate?.split('T')[0] || '',
    cost: maintenance?.cost?.toString() || '',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => assetsApi.maintenance.create(data),
    onSuccess: () => {
      toast.success('Maintenance record created successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create maintenance record');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      assetsApi.maintenance.update(id, data),
    onSuccess: () => {
      toast.success('Maintenance record updated successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update maintenance record');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data: any = {
      assetId,
      title: formData.title,
      type: formData.type,
      status: formData.status,
      description: formData.description || undefined,
      performedBy: formData.performedBy || undefined,
      performedAt: formData.performedAt || undefined,
      nextDueDate: formData.nextDueDate || undefined,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
    };

    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) delete data[key];
    });

    if (maintenance) {
      updateMutation.mutate({ id: maintenance.id, data });
    } else {
      createMutation.mutate(data);
    }

    setIsSubmitting(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={maintenance ? 'Edit Maintenance Record' : 'Add Maintenance Record'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !formData.title}
          >
            {isPending ? 'Saving...' : maintenance ? 'Update' : 'Create'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Quarterly Security Update"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Maintenance Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={[
              { value: 'preventive', label: 'Preventive' },
              { value: 'corrective', label: 'Corrective' },
              { value: 'adaptive', label: 'Adaptive' },
              { value: 'perfective', label: 'Perfective' },
            ]}
          />

          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the maintenance work..."
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Performed By"
            value={formData.performedBy}
            onChange={(e) => setFormData({ ...formData, performedBy: e.target.value })}
            placeholder="e.g., John Smith"
          />

          <Input
            label="Cost"
            type="number"
            step="0.01"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Performed Date"
            type="date"
            value={formData.performedAt}
            onChange={(e) => setFormData({ ...formData, performedAt: e.target.value })}
          />

          <Input
            label="Next Due Date"
            type="date"
            value={formData.nextDueDate}
            onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
