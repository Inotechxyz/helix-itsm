import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ticketsApi, categoriesApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { showToast } from '../components/ui/Toast';
import { ArrowLeft } from 'lucide-react';

export function TicketFormPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    type: 'incident',
    title: '',
    description: '',
    priority: 'medium',
    categoryId: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => ticketsApi.create(data),
    onSuccess: (response) => {
      showToast(`Ticket #${response.data.id} created successfully!`, 'success');
      setTimeout(() => {
        navigate(`/tickets/${response.data.id}`);
      }, 500);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="h-full overflow-y-auto pr-2">
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/app/tickets')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Ticket</h1>
          <p className="text-muted-foreground">Submit a new support request</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Ticket Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value="incident"
                    checked={formData.type === 'incident'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="text-primary"
                  />
                  <span>Incident</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value="service_request"
                    checked={formData.type === 'service_request'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="text-primary"
                  />
                  <span>Service Request</span>
                </label>
              </div>
            </div>

            <Input
              label="Title"
              placeholder="Brief summary of your issue"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />

            <Textarea
              label="Description"
              placeholder="Please describe your issue in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              required
            />

            <div>
              <label className="block text-sm font-medium mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 rounded-md border bg-background"
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/app/tickets')}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
