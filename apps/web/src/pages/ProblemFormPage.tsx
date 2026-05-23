import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { problemsApi, usersApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Tooltip } from '../components/ui/Tooltip';
import { toast } from 'sonner';

export function ProblemFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'new',
    priority: 'medium',
    impact: 'moderate',
    category: '',
    assignedToId: '',
  });

  const { data: problem } = useQuery({
    queryKey: ['problem', id],
    queryFn: () => problemsApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const { data: agents } = useQuery({
    queryKey: ['users', 'agents'],
    queryFn: () => usersApi.list({ orgRole: 'agent', limit: 100 }).then((r) => r.data.items),
  });

  useEffect(() => {
    if (problem) {
      setFormData({
        title: problem.title || '',
        description: problem.description || '',
        status: problem.status || 'new',
        priority: problem.priority || 'medium',
        impact: problem.impact || 'moderate',
        category: problem.category || '',
        assignedToId: problem.assignedToId || '',
      });
    }
  }, [problem]);

  const createMutation = useMutation({
    mutationFn: (data: any) => problemsApi.create(data),
    onSuccess: (response: any) => {
      toast.success('Problem created successfully');
      navigate(`/problems/${response.data.id}`);
    },
    onError: () => {
      toast.error('Failed to create problem');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => problemsApi.update(id!, data),
    onSuccess: () => {
      toast.success('Problem updated successfully');
      navigate(`/problems/${id}`);
    },
    onError: () => {
      toast.error('Failed to update problem');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="h-full overflow-y-auto pr-2">
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Tooltip content="Back">
          <Button variant="ghost" size="icon" onClick={() => navigate('/problems')}>
            ←
          </Button>
        </Tooltip>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Problem' : 'New Problem'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Update problem details'
              : 'Create a new problem to track recurring issues'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Problem Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Database connection pool exhaustion"
              required
            />

            <Textarea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the problem in detail..."
              rows={5}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                options={[
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
              />

              <Select
                label="Impact"
                value={formData.impact}
                onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                options={[
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'low', label: 'Low' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                options={[
                  { value: '', label: 'Select category' },
                  { value: 'hardware', label: 'Hardware' },
                  { value: 'software', label: 'Software' },
                  { value: 'network', label: 'Network' },
                  { value: 'security', label: 'Security' },
                  { value: 'database', label: 'Database' },
                  { value: 'application', label: 'Application' },
                  { value: 'infrastructure', label: 'Infrastructure' },
                  { value: 'other', label: 'Other' },
                ]}
              />

              <Select
                label="Assigned To"
                value={formData.assignedToId}
                onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(agents?.map((user: any) => ({
                    value: user.id,
                    label: `${user.firstName} ${user.lastName}`,
                  })) || []),
                ]}
              />
            </div>

            {isEditing && (
              <Select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={[
                  { value: 'new', label: 'New' },
                  { value: 'investigating', label: 'Investigating' },
                  { value: 'identified', label: 'Identified' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/problems')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || !formData.title}>
            {isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
    </div>
  );
}
