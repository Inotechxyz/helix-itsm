import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { changesApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Tooltip } from '../components/ui/Tooltip';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export function ChangeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'normal',
    priority: 'medium',
    risk: 'low',
    category: '',
    justification: '',
    implementationPlan: '',
    rollbackPlan: '',
    scheduledStartDate: '',
    scheduledEndDate: '',
  });

  const { data: existingChange, isLoading } = useQuery({
    queryKey: ['change', id],
    queryFn: () => changesApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (existingChange) {
      setForm({
        title: existingChange.title || '',
        description: existingChange.description || '',
        type: existingChange.type || 'normal',
        priority: existingChange.priority || 'medium',
        risk: existingChange.risk || 'low',
        category: existingChange.category || '',
        justification: existingChange.justification || '',
        implementationPlan: existingChange.implementationPlan || '',
        rollbackPlan: existingChange.rollbackPlan || '',
        scheduledStartDate: existingChange.scheduledStartDate ? new Date(existingChange.scheduledStartDate).toISOString().slice(0, 16) : '',
        scheduledEndDate: existingChange.scheduledEndDate ? new Date(existingChange.scheduledEndDate).toISOString().slice(0, 16) : '',
      });
    }
  }, [existingChange]);

  const createMutation = useMutation({
    mutationFn: (data: any) => changesApi.create(data),
    onSuccess: (response) => {
      toast.success('Change request created');
      navigate(`/changes/${response.data.id}`);
    },
    onError: () => {
      toast.error('Failed to create change request');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => changesApi.update(id!, data),
    onSuccess: () => {
      toast.success('Change request updated');
      navigate(`/changes/${id}`);
    },
    onError: () => {
      toast.error('Failed to update change request');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = { ...form };
    if (form.scheduledStartDate) {
      data.scheduledStartDate = new Date(form.scheduledStartDate).toISOString();
    }
    if (form.scheduledEndDate) {
      data.scheduledEndDate = new Date(form.scheduledEndDate).toISOString();
    }

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Tooltip content="Back">
          <Link to="/changes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
        </Tooltip>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Edit Change Request' : 'New Change Request'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Update change request details' : 'Create a new change request'}
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
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief description of the change"
              required
            />

            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed description of what needs to be changed and why"
              rows={4}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Change Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                options={[
                  { value: 'standard', label: 'Standard (Pre-approved)' },
                  { value: 'normal', label: 'Normal (Full approval)' },
                  { value: 'emergency', label: 'Emergency (Fast-track)' },
                ]}
              />

              <Select
                label="Priority"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                options={[
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
              />

              <Select
                label="Risk Level"
                value={form.risk}
                onChange={(e) => setForm({ ...form, risk: e.target.value })}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
            </div>

            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g., Hardware, Software, Network, Security"
            />
          </CardContent>
        </Card>

        {/* Justification */}
        <Card>
          <CardHeader>
            <CardTitle>Business Justification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              label="Justification"
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
              placeholder="Why is this change needed? What business value does it provide?"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Implementation Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              label="Implementation Plan"
              value={form.implementationPlan}
              onChange={(e) => setForm({ ...form, implementationPlan: e.target.value })}
              placeholder="Step-by-step plan for implementing this change"
              rows={4}
            />

            <Textarea
              label="Rollback Plan"
              value={form.rollbackPlan}
              onChange={(e) => setForm({ ...form, rollbackPlan: e.target.value })}
              placeholder="How to rollback if the change causes issues"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="datetime-local"
                label="Scheduled Start"
                value={form.scheduledStartDate}
                onChange={(e) => setForm({ ...form, scheduledStartDate: e.target.value })}
              />

              <Input
                type="datetime-local"
                label="Scheduled End"
                value={form.scheduledEndDate}
                onChange={(e) => setForm({ ...form, scheduledEndDate: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" type="button" onClick={() => navigate('/changes')}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Update Change Request' : 'Create Change Request'}
          </Button>
        </div>
      </form>
    </div>
    </div>
  );
}
