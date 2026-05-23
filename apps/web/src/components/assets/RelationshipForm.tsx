import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { assetsApi } from '../../api/client';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { toast } from 'sonner';

interface RelationshipFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAssetId: string;
  relationship?: {
    id: string;
    fromAssetId: string;
    toAssetId: string;
    type: string;
    description: string | null;
    isActive: boolean;
  };
}

export function RelationshipForm({
  isOpen,
  onClose,
  onSuccess,
  currentAssetId,
  relationship,
}: RelationshipFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [showAssetSearch, setShowAssetSearch] = useState(!relationship);

  const { data: assetSearchResults, isLoading: isSearching } = useQuery({
    queryKey: ['assets', 'search', searchQuery],
    queryFn: () =>
      assetsApi.list({ search: searchQuery, limit: 10 }).then((r) => r.data.items),
    enabled: searchQuery.length >= 2,
  });

  const { data: selectedAsset } = useQuery({
    queryKey: ['asset', selectedAssetId],
    queryFn: () => assetsApi.get(selectedAssetId).then((r) => r.data),
    enabled: !!selectedAssetId,
  });

  const [formData, setFormData] = useState({
    type: relationship?.type || 'connects_to',
    description: relationship?.description || '',
    isActive: relationship?.isActive ?? true,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => assetsApi.relationships.create(data),
    onSuccess: () => {
      toast.success('Relationship created successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create relationship');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      assetsApi.relationships.update(id, data),
    onSuccess: () => {
      toast.success('Relationship updated successfully');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update relationship');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!relationship && !selectedAssetId) {
      toast.error('Please select an asset');
      return;
    }

    const data: any = {
      type: formData.type,
      description: formData.description || undefined,
      isActive: formData.isActive,
    };

    if (relationship) {
      updateMutation.mutate({ id: relationship.id, data });
    } else {
      // Creating new relationship - determine direction
      data.fromAssetId = currentAssetId;
      data.toAssetId = selectedAssetId;
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={relationship ? 'Edit Relationship' : 'Add Relationship'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || (!relationship && !selectedAssetId)}
          >
            {isPending ? 'Saving...' : relationship ? 'Update' : 'Create'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!relationship && (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">Related Asset</label>
              {selectedAsset ? (
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedAsset.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedAsset.assetTag}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAssetId('');
                      setShowAssetSearch(true);
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : showAssetSearch ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {isSearching && (
                    <p className="text-sm text-muted-foreground">Searching...</p>
                  )}
                  {searchQuery.length >= 2 && assetSearchResults && (
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {assetSearchResults.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">No assets found</p>
                      ) : (
                        assetSearchResults.map((asset: any) => (
                          <button
                            key={asset.id}
                            type="button"
                            className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-b-0"
                            onClick={() => {
                              setSelectedAssetId(asset.id);
                              setShowAssetSearch(false);
                              setSearchQuery('');
                            }}
                          >
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {asset.assetTag} • {asset.type?.name}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}

        {relationship && (
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-muted-foreground">Relationship between assets</p>
          </div>
        )}

        <Select
          label="Relationship Type"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          options={[
            { value: 'hosts', label: 'Hosts' },
            { value: 'depends_on', label: 'Depends On' },
            { value: 'connects_to', label: 'Connects To' },
            { value: 'supports', label: 'Supports' },
            { value: 'runs_on', label: 'Runs On' },
            { value: 'backup_of', label: 'Backup Of' },
            { value: 'replicated_to', label: 'Replicated To' },
          ]}
        />

        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe this relationship..."
          rows={3}
        />

        {relationship && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Active relationship
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
}
