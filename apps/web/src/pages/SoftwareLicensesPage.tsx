import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { softwareLicensesApi, usersApi, assetsApi } from '../api/client';
import { useCurrentOrganizationId } from '../stores/organizationStore';
import { showToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Tooltip } from '../components/ui/Tooltip';
import { Edit2, Trash2, XCircle, UserPlus } from 'lucide-react';

interface Software {
  id: string;
  name: string;
  slug: string;
  version?: string;
  vendor?: string;
  category?: string;
  description?: string;
  licenseType: string;
  isActive: boolean;
  licenses?: any[];
}

interface License {
  id: string;
  name: string;
  licenseKey?: string;
  licenseType: string;
  totalSeats: number;
  purchasedSeats: number;
  cost?: number;
  expiryDate?: string;
  isActive: boolean;
  software?: { id: string; name: string; slug: string };
  _count?: { assignments: number };
}

interface LicenseStats {
  totalSoftware: number;
  totalLicenses: number;
  activeLicenses: number;
  expiringLicenses: number;
  totalAssignments: number;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
  seatUtilization: number;
}

type TabType = 'overview' | 'software' | 'licenses' | 'assignments';

export function SoftwareLicensesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSoftwareModal, setShowSoftwareModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingSoftware, setEditingSoftware] = useState<Software | null>(null);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
  const organizationId = useCurrentOrganizationId();

  const queryClient = useQueryClient();

  // Fetch stats
  const { data: stats } = useQuery<LicenseStats>({
    queryKey: ['licenseStats', organizationId],
    queryFn: () => softwareLicensesApi.getStats().then(res => res.data),
    enabled: !!organizationId,
  });

  // Fetch software list
  const { data: softwareData, isLoading: softwareLoading } = useQuery({
    queryKey: ['software', organizationId, searchTerm],
    queryFn: () => softwareLicensesApi.software.list({ search: searchTerm }).then(res => res.data),
    enabled: !!organizationId,
  });

  // Fetch licenses list
  const { data: licensesData, isLoading: licensesLoading } = useQuery({
    queryKey: ['licenses', organizationId, searchTerm],
    queryFn: () => softwareLicensesApi.licenses.list({ search: searchTerm }).then(res => res.data),
    enabled: !!organizationId,
  });

  // Fetch assignments
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', organizationId],
    queryFn: () => softwareLicensesApi.assignments.list({}).then(res => res.data),
    enabled: !!organizationId,
  });

  // Fetch users for assignment dropdown
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ isActive: true }).then(res => res.data),
  });

  // Fetch assets for assignment dropdown
  const { data: assetsData } = useQuery({
    queryKey: ['assets-list'],
    queryFn: () => assetsApi.list({ status: ['active'] }).then(res => res.data),
  });

  // Software mutations
  const createSoftwareMutation = useMutation({
    mutationFn: (data: any) => softwareLicensesApi.software.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software'] });
      queryClient.invalidateQueries({ queryKey: ['licenseStats'] });
      showToast('Software created successfully', 'success');
      setShowSoftwareModal(false);
    },
    onError: () => showToast('Failed to create software', 'error'),
  });

  const updateSoftwareMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      softwareLicensesApi.software.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software'] });
      showToast('Software updated successfully', 'success');
      setShowSoftwareModal(false);
      setEditingSoftware(null);
    },
    onError: () => showToast('Failed to update software', 'error'),
  });

  const deleteSoftwareMutation = useMutation({
    mutationFn: (id: string) => softwareLicensesApi.software.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software'] });
      queryClient.invalidateQueries({ queryKey: ['licenseStats'] });
      showToast('Software deleted successfully', 'success');
    },
    onError: () => showToast('Failed to delete software', 'error'),
  });

  // License mutations
  const createLicenseMutation = useMutation({
    mutationFn: (data: any) => softwareLicensesApi.licenses.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['licenseStats'] });
      showToast('License created successfully', 'success');
      setShowLicenseModal(false);
    },
    onError: () => showToast('Failed to create license', 'error'),
  });

  const updateLicenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      softwareLicensesApi.licenses.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['licenseStats'] });
      showToast('License updated successfully', 'success');
      setShowLicenseModal(false);
      setEditingLicense(null);
    },
    onError: () => showToast('Failed to update license', 'error'),
  });

  const deleteLicenseMutation = useMutation({
    mutationFn: (id: string) => softwareLicensesApi.licenses.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['licenseStats'] });
      showToast('License deleted successfully', 'success');
    },
    onError: () => showToast('Failed to delete license', 'error'),
  });

  // Assignment mutations
  const createAssignmentMutation = useMutation({
    mutationFn: (data: any) => softwareLicensesApi.assignments.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['licenseStats'] });
      showToast('Assignment created successfully', 'success');
      setShowAssignmentModal(false);
    },
    onError: () => showToast('Failed to create assignment', 'error'),
  });

  const revokeAssignmentMutation = useMutation({
    mutationFn: (id: string) => softwareLicensesApi.assignments.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['licenseStats'] });
      showToast('Assignment revoked successfully', 'success');
    },
    onError: () => showToast('Failed to revoke assignment', 'error'),
  });

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const daysUntilExpiry = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Software Licenses</h1>
          <p className="text-gray-600">Manage software catalog and license tracking</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowSoftwareModal(true)}>
            Add Software
          </Button>
          <Button onClick={() => setShowLicenseModal(true)} variant="secondary">
            Add License
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'software', 'licenses', 'assignments'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500">Total Software</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalSoftware}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500">Active Licenses</div>
            <div className="text-3xl font-bold text-indigo-600">{stats.activeLicenses}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500">Expiring Soon</div>
            <div className="text-3xl font-bold text-amber-600">{stats.expiringLicenses}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500">Seat Utilization</div>
            <div className="text-3xl font-bold text-green-600">{stats.seatUtilization}%</div>
            <div className="text-sm text-gray-500">
              {stats.usedSeats} of {stats.totalSeats} seats used
            </div>
          </div>
        </div>
      )}

      {/* Software Tab */}
      {activeTab === 'software' && (
        <div>
          <div className="mb-4">
            <Input
              placeholder="Search software..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Licenses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {softwareData?.items?.map((software: Software) => (
                  <tr key={software.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{software.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{software.version || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{software.vendor || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {software.licenseType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {software.licenses?.length || 0} licenses
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        software.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {software.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Tooltip content="Edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSoftware(software);
                              setShowSoftwareModal(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Delete">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this software?')) {
                                deleteSoftwareMutation.mutate(software.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Licenses Tab */}
      {activeTab === 'licenses' && (
        <div>
          <div className="mb-4">
            <Input
              placeholder="Search licenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seats</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {licensesData?.items?.map((license: License) => (
                  <tr key={license.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{license.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{license.software?.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {license._count?.assignments || 0} / {license.totalSeats}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {license.expiryDate ? (
                        <span className={`${
                          isExpired(license.expiryDate) ? 'text-red-600' :
                          isExpiringSoon(license.expiryDate) ? 'text-amber-600' : 'text-gray-500'
                        }`}>
                          {new Date(license.expiryDate).toLocaleDateString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        license.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {license.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Tooltip content="Edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingLicense(license);
                              setShowLicenseModal(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Delete">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this license?')) {
                                deleteLicenseMutation.mutate(license.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">License Assignments</h2>
            <Button onClick={() => setShowAssignmentModal(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Create Assignment
            </Button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignmentsData?.map((assignment: any) => (
                <tr key={assignment.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {assignment.license?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {assignment.user ? `${assignment.user.firstName} ${assignment.user.lastName}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {assignment.asset?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Date(assignment.assignedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      assignment.revokedAt ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {assignment.revokedAt ? 'Revoked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {!assignment.revokedAt && (
                      <div className="flex justify-end">
                        <Tooltip content="Revoke">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to revoke this assignment?')) {
                                revokeAssignmentMutation.mutate(assignment.id);
                              }
                            }}
                          >
                            <XCircle className="w-4 h-4 text-amber-600" />
                          </Button>
                        </Tooltip>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Software Modal */}
      <Modal
        isOpen={showSoftwareModal}
        onClose={() => {
          setShowSoftwareModal(false);
          setEditingSoftware(null);
        }}
        title={editingSoftware ? 'Edit Software' : 'Add Software'}
      >
        <SoftwareForm
          software={editingSoftware}
          onSubmit={(data) => {
            if (editingSoftware) {
              updateSoftwareMutation.mutate({ id: editingSoftware.id, data });
            } else {
              createSoftwareMutation.mutate(data);
            }
          }}
          onCancel={() => {
            setShowSoftwareModal(false);
            setEditingSoftware(null);
          }}
          isLoading={createSoftwareMutation.isPending || updateSoftwareMutation.isPending}
        />
      </Modal>

      {/* License Modal */}
      <Modal
        isOpen={showLicenseModal}
        onClose={() => {
          setShowLicenseModal(false);
          setEditingLicense(null);
        }}
        title={editingLicense ? 'Edit License' : 'Add License'}
      >
        <LicenseForm
          license={editingLicense}
          softwareList={softwareData?.items || []}
          onSubmit={(data) => {
            if (editingLicense) {
              updateLicenseMutation.mutate({ id: editingLicense.id, data });
            } else {
              createLicenseMutation.mutate(data);
            }
          }}
          onCancel={() => {
            setShowLicenseModal(false);
            setEditingLicense(null);
          }}
          isLoading={createLicenseMutation.isPending || updateLicenseMutation.isPending}
        />
      </Modal>

      {/* Assignment Modal */}
      <Modal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        title="Create License Assignment"
      >
        <AssignmentForm
          licenses={licensesData?.items || []}
          users={usersData?.items || []}
          assets={assetsData?.items || []}
          onSubmit={(data) => createAssignmentMutation.mutate(data)}
          onCancel={() => setShowAssignmentModal(false)}
          isLoading={createAssignmentMutation.isPending}
        />
      </Modal>
    </div>
  );
}

// Software Form Component
function SoftwareForm({ software, onSubmit, onCancel, isLoading }: {
  software?: Software | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: software?.name || '',
    version: software?.version || '',
    vendor: software?.vendor || '',
    description: software?.description || '',
    licenseType: software?.licenseType || 'per_seat',
    isActive: software?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Version</label>
          <Input
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Vendor</label>
          <Input
            value={formData.vendor}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">License Type</label>
        <select
          value={formData.licenseType}
          onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="per_seat">Per Seat</option>
          <option value="perpetual">Perpetual</option>
          <option value="subscription">Subscription</option>
          <option value="site_license">Site License</option>
          <option value="volume">Volume</option>
          <option value="freeware">Freeware</option>
          <option value="open_source">Open Source</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {software ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

// License Form Component
function LicenseForm({ license, softwareList, onSubmit, onCancel, isLoading }: {
  license?: License | null;
  softwareList: Software[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    softwareId: license?.software?.id || '',
    name: license?.name || '',
    licenseKey: license?.licenseKey || '',
    licenseType: license?.licenseType || 'per_seat',
    totalSeats: license?.totalSeats || 1,
    cost: license?.cost || 0,
    expiryDate: license?.expiryDate ? license.expiryDate.split('T')[0] : '',
    isActive: license?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      expiryDate: formData.expiryDate || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Software</label>
        <select
          value={formData.softwareId}
          onChange={(e) => setFormData({ ...formData, softwareId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="">Select software...</option>
          {softwareList.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">License Name</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Microsoft 365 E3 - Enterprise"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">License Key</label>
        <Input
          value={formData.licenseKey}
          onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Total Seats</label>
          <Input
            type="number"
            min={1}
            value={formData.totalSeats}
            onChange={(e) => setFormData({ ...formData, totalSeats: parseInt(e.target.value) })}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Cost ($)</label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
        <Input
          type="date"
          value={formData.expiryDate}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {license ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

// Assignment Form Component
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Asset {
  id: string;
  name: string;
  assetTag: string;
  status?: string;
}

interface AssignmentFormProps {
  licenses: License[];
  users: User[];
  assets: Asset[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function AssignmentForm({ licenses, users, assets, onSubmit, onCancel, isLoading }: AssignmentFormProps) {
  const [formData, setFormData] = useState({
    licenseId: '',
    userId: '',
    assetId: '',
    notes: '',
  });
  const [assignmentType, setAssignmentType] = useState<'user' | 'device'>('user');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.licenseId) {
      showToast('Please select a license', 'error');
      return;
    }

    if (!formData.userId && !formData.assetId) {
      showToast('Please select a user or device', 'error');
      return;
    }

    onSubmit({
      licenseId: formData.licenseId,
      userId: assignmentType === 'user' ? formData.userId || undefined : undefined,
      assetId: assignmentType === 'device' ? formData.assetId || undefined : undefined,
      notes: formData.notes || undefined,
    });
  };

  // Filter licenses with available seats
  const availableLicenses = licenses.filter(license => {
    const usedSeats = license._count?.assignments || 0;
    return usedSeats < license.totalSeats && license.isActive;
  });

  // Filter active assets
  const activeAssets = assets.filter(asset => asset.status === 'active');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* License Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          License <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.licenseId}
          onChange={(e) => setFormData({ ...formData, licenseId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="">Select a license...</option>
          {availableLicenses.map((license) => {
            const usedSeats = license._count?.assignments || 0;
            return (
              <option key={license.id} value={license.id}>
                {license.name} ({license.software?.name || 'Unknown'}) - {usedSeats}/{license.totalSeats} seats used
              </option>
            );
          })}
        </select>
        {availableLicenses.length === 0 && (
          <p className="text-sm text-amber-600 mt-1">No licenses with available seats found.</p>
        )}
      </div>

      {/* Assignment Type Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Assign To <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="assignmentType"
              value="user"
              checked={assignmentType === 'user'}
              onChange={() => {
                setAssignmentType('user');
                setFormData({ ...formData, assetId: '' });
              }}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">User</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="assignmentType"
              value="device"
              checked={assignmentType === 'device'}
              onChange={() => {
                setAssignmentType('device');
                setFormData({ ...formData, userId: '' });
              }}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Device</span>
          </label>
        </div>
      </div>

      {/* User Selection */}
      {assignmentType === 'user' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            User <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.userId}
            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select a user...</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.email})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Asset Selection */}
      {assignmentType === 'device' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Device <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.assetId}
            onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select a device...</option>
            {activeAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.assetTag})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          placeholder="Optional notes about this assignment..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          Create Assignment
        </Button>
      </div>
    </form>
  );
}

export default SoftwareLicensesPage;
