import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { serviceCatalogApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { ArrowLeft, Clock, CheckCircle } from 'lucide-react';

export function ServiceRequestPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [justification, setJustification] = useState('');

  const { data: service, isLoading } = useQuery({
    queryKey: ['service', slug],
    queryFn: () => serviceCatalogApi.services.get(slug!).then((r) => r.data),
  });

  // Mutation to submit the request after creation
  const submitRequestMutation = useMutation({
    mutationFn: (requestId: string) => serviceCatalogApi.requests.submit(requestId),
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: { serviceId: string; justification?: string; formData?: Record<string, unknown> }) =>
      serviceCatalogApi.requests.create(data),
    onSuccess: (response) => {
      // Automatically submit the request to move it from draft to pending_approval or in_progress
      const requestId = response.data?.id;
      if (requestId) {
        submitRequestMutation.mutate(requestId, {
          onSuccess: () => {
            navigate('/service-catalog');
          },
          onError: () => {
            // Even if submit fails, navigate back to catalog
            navigate('/service-catalog');
          },
        });
      } else {
        navigate('/service-catalog');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;

    createRequestMutation.mutate({
      serviceId: service.id,
      justification: justification || undefined,
      formData,
    });
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (!service) {
    return <div>Service not found</div>;
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/service-catalog"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Service Catalog
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{service.name}</CardTitle>
              <p className="text-muted-foreground mt-1">{service.category?.name}</p>
            </div>
            {service.price !== null && service.price > 0 && (
              <span className="text-2xl font-bold text-primary">${service.price}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground mb-6">
            {service.deliveryTimeDays && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Delivery in {service.deliveryTimeDays} day(s)</span>
              </div>
            )}
            {service.slaHours && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>SLA: {service.slaHours} hours</span>
              </div>
            )}
            {service.requiresApproval ? (
              <div className="flex items-center gap-2">
                <span>Requires approval</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Auto-fulfillment available</span>
              </div>
            )}
          </div>

          {service.description && (
            <div className="mb-6">
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-muted-foreground">{service.description}</p>
            </div>
          )}

          {service.instructions && (
            <div className="mb-6">
              <h3 className="font-medium mb-2">Instructions</h3>
              <p className="text-muted-foreground">{service.instructions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dynamic Form Fields */}
            {service.formFields?.map((field: any) => (
              <div key={field.name}>
                <label className="block text-sm font-medium mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'text' && (
                  <Input
                    name={field.name}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    required={field.required}
                  />
                )}
                {field.type === 'textarea' && (
                  <Textarea
                    name={field.name}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    required={field.required}
                  />
                )}
                {field.type === 'select' && (
                  <select
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    required={field.required}
                  >
                    <option value="">Select...</option>
                    {field.options?.map((option: string) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}

            {/* Justification */}
            {service.requiresApproval && (
              <Textarea
                label="Justification"
                placeholder="Please provide a business justification for this request..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
              />
            )}

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate('/service-catalog')}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRequestMutation.isPending || submitRequestMutation.isPending}>
                {createRequestMutation.isPending || submitRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
