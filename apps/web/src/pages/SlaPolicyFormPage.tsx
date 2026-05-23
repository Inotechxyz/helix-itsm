import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slaApi, categoriesApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { showToast } from '../components/ui/Toast';

const priorityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const ticketTypeOptions = [
  { value: 'incident', label: 'Incident' },
  { value: 'service_request', label: 'Service Request' },
];

const userTierOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'vip', label: 'VIP' },
];

export function SlaPolicyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium',
    ticketType: '',
    userTier: '',
    responseTimeHours: 4,
    resolutionTimeHours: 24,
    warningThreshold: 75,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch categories for dropdown
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.tree().then((r) => r.data),
  });

  // Fetch existing policy if editing
  const { data: policyData, isLoading: isLoadingPolicy } = useQuery({
    queryKey: ['sla-policy', id],
    queryFn: () => slaApi.policies.get(id!).then((r) => r.data),
    enabled: isEditing,
  });

  // Fetch escalation rules for this policy
  const { data: escalationRulesData } = useQuery({
    queryKey: ['escalation-rules', id],
    queryFn: () => slaApi.escalationRules.list(id!).then((r) => r.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (policyData) {
      setFormData({
        name: policyData.name || '',
        description: policyData.description || '',
        priority: policyData.priority || 'medium',
        ticketType: policyData.ticketType || '',
        userTier: policyData.userTier || '',
        responseTimeHours: policyData.responseTimeHours || 4,
        resolutionTimeHours: policyData.resolutionTimeHours || 24,
        warningThreshold: policyData.warningThreshold || 75,
      });
    }
  }, [policyData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => slaApi.policies.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
      showToast('SLA Policy created successfully', 'success');
      navigate('/admin/sla-policies');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to create SLA Policy', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => slaApi.policies.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
      showToast('SLA Policy updated successfully', 'success');
      navigate('/admin/sla-policies');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to update SLA Policy', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (formData.responseTimeHours <= 0) {
      newErrors.responseTimeHours = 'Response time must be greater than 0';
    }
    if (formData.resolutionTimeHours <= 0) {
      newErrors.resolutionTimeHours = 'Resolution time must be greater than 0';
    }
    if (formData.warningThreshold < 1 || formData.warningThreshold > 100) {
      newErrors.warningThreshold = 'Warning threshold must be between 1 and 100';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const submitData = {
      ...formData,
      ticketType: formData.ticketType || null,
      userTier: formData.userTier || null,
    };

    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  if (isEditing && isLoadingPolicy) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{isEditing ? 'Edit SLA Policy' : 'New SLA Policy'}</h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Update the SLA policy configuration'
              : 'Create a new Service Level Agreement policy'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/sla-policies')}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Policy Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Standard - High Priority"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe when this policy should be applied..."
                  className="w-full px-3 py-2 rounded-md border bg-background min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Applies To */}
          <Card>
            <CardHeader>
              <CardTitle>Applies To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Priority *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                  >
                    {priorityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ticket Type</label>
                  <select
                    value={formData.ticketType}
                    onChange={(e) => handleChange('ticketType', e.target.value)}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                  >
                    <option value="">Any Type</option>
                    {ticketTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">User Tier</label>
                  <select
                    value={formData.userTier}
                    onChange={(e) => handleChange('userTier', e.target.value)}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                  >
                    <option value="">Any Tier</option>
                    {userTierOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This policy will be applied when all conditions match. If no specific type or tier is
                selected, the policy applies to all matching priority tickets.
              </p>
            </CardContent>
          </Card>

          {/* SLA Targets */}
          <Card>
            <CardHeader>
              <CardTitle>SLA Targets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    First Response Time (hours) *
                  </label>
                  <Input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={formData.responseTimeHours}
                    onChange={(e) => handleChange('responseTimeHours', parseFloat(e.target.value))}
                    className={errors.responseTimeHours ? 'border-red-500' : ''}
                  />
                  {errors.responseTimeHours && (
                    <p className="text-sm text-red-500 mt-1">{errors.responseTimeHours}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Target time for first response (supports fractions, e.g., 0.5 for 30 minutes)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Resolution Time (hours) *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.resolutionTimeHours}
                    onChange={(e) => handleChange('resolutionTimeHours', parseInt(e.target.value))}
                    className={errors.resolutionTimeHours ? 'border-red-500' : ''}
                  />
                  {errors.resolutionTimeHours && (
                    <p className="text-sm text-red-500 mt-1">{errors.resolutionTimeHours}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Target time for full resolution
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Warning Threshold (%) *
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.warningThreshold}
                  onChange={(e) => handleChange('warningThreshold', parseInt(e.target.value))}
                  className={errors.warningThreshold ? 'border-red-500' : ''}
                />
                {errors.warningThreshold && (
                  <p className="text-sm text-red-500 mt-1">{errors.warningThreshold}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Send warning when this percentage of time has elapsed (e.g., 75 = warn at 75% of
                  SLA time)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Escalation Rules (if editing) */}
          {isEditing && escalationRulesData && escalationRulesData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Escalation Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {escalationRulesData.map((rule: any) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {rule.condition.replace(/_/g, ' ')} after {rule.thresholdHours}h →{' '}
                          {rule.action.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Escalation rules can be managed from the API or through separate endpoints.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => navigate('/admin/sla-policies')}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEditing
                  ? 'Update Policy'
                  : 'Create Policy'}
            </Button>
          </div>
        </div>
      </form>
    </div>
    </div>
  );
}
