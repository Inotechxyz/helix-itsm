import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi, usersApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Tooltip } from '../../components/ui/Tooltip';
import { UserPlus, Edit2, Trash2, Users, X, Plus, Crown } from 'lucide-react';
import { showToast } from '../../components/ui/Toast';

const teamTypeColors: Record<string, string> = {
  first_line: 'bg-green-100 text-green-800',
  second_line: 'bg-yellow-100 text-yellow-800',
  third_line: 'bg-red-100 text-red-800',
};

export function AdminTeamsPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [showModal, setShowModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'first_line',
    description: '',
    leadId: '',
  });
  const [newMemberId, setNewMemberId] = useState('');

  const { data: teams, isLoading } = useQuery({
    queryKey: ['admin-teams', organizationId],
    queryFn: () => teamsApi.list().then((r) => r.data),
    enabled: !!organizationId,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-assignment', organizationId],
    queryFn: () => usersApi.list().then((r) => r.data.items),
    enabled: !!organizationId,
  });

  // Transform users to include teams array
  const users = usersData?.map((user: any) => ({
    ...user,
    teams: user.teams?.map((ut: any) => ut.team) || [],
  }));

  const { data: teamMembers } = useQuery({
    queryKey: ['team-members', selectedTeam?.id],
    queryFn: () => teamsApi.getMembers(selectedTeam?.id).then((r) => r.data),
    enabled: !!selectedTeam?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => teamsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      showToast('Team created successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to create team', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teamsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      showToast('Team updated successfully', 'success');
      closeModal();
    },
    onError: () => showToast('Failed to update team', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      showToast('Team deleted successfully', 'success');
    },
    onError: () => showToast('Failed to delete team', 'error'),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApi.addMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      setNewMemberId('');
      showToast('Member added successfully', 'success');
    },
    onError: () => showToast('Failed to add member', 'error'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApi.removeMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-teams'] });
      showToast('Member removed successfully', 'success');
    },
    onError: () => showToast('Failed to remove member', 'error'),
  });

  const openCreateModal = () => {
    setEditingTeam(null);
    setFormData({ name: '', type: 'first_line', description: '', leadId: '' });
    setShowModal(true);
  };

  const openEditModal = (team: any) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      type: team.type,
      description: team.description || '',
      leadId: team.lead?.id || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTeam(null);
  };

  const openMembersModal = (team: any) => {
    setSelectedTeam(team);
    setShowMembersModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, any> = { ...formData };
    if (!data.leadId) delete data.leadId;
    if (!data.description) delete data.description;

    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const availableUsers = users?.filter((user: any) => {
    const isInTeam = teamMembers?.some((m: any) => m.userId === user.id);
    return !isInTeam;
  });

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground">Manage support teams and assign members</p>
        </div>
        <Button onClick={openCreateModal}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Team
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : teams?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No teams found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams?.map((team: any) => (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{team.name}</CardTitle>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${teamTypeColors[team.type] || ''}`}>
                      {team.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {team.description && (
                  <p className="text-sm text-muted-foreground mb-4">{team.description}</p>
                )}
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-muted-foreground">{team._count?.members || 0} members</span>
                  {team.lead && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Crown className="w-3 h-3" />
                      {team.lead.firstName} {team.lead.lastName}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" size="sm" onClick={() => openMembersModal(team)}>
                    <Users className="w-4 h-4 mr-1" />
                    Members
                  </Button>
                  <div className="flex gap-1">
                    <Tooltip content="Edit">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(team)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this team?')) {
                            deleteMutation.mutate(team.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Team Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={editingTeam ? 'Edit Team' : 'Create Team'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Team Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium mb-2">Team Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
            >
              <option value="first_line">First Line</option>
              <option value="second_line">Second Line</option>
              <option value="third_line">Third Line</option>
            </select>
          </div>
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium mb-2">Team Lead</label>
            <select
              value={formData.leadId}
              onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
              className="w-full px-3 py-2 rounded-md border bg-background"
            >
              <option value="">Select a team lead...</option>
              {users?.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.role})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingTeam ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Members Management Modal */}
      <Modal isOpen={showMembersModal} onClose={() => setShowMembersModal(false)} title={`Team Members: ${selectedTeam?.name}`}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <select
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border bg-background"
            >
              <option value="">Select a user to add...</option>
              {availableUsers?.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} - {user.email}
                </option>
              ))}
            </select>
            <Button
              onClick={() => {
                if (newMemberId && selectedTeam) {
                  addMemberMutation.mutate({ teamId: selectedTeam.id, userId: newMemberId });
                }
              }}
              disabled={!newMemberId || addMemberMutation.isPending}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="border rounded-lg divide-y">
            {teamMembers?.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No members in this team</div>
            ) : (
              teamMembers?.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.user?.firstName} {member.user?.lastName}
                        {member.isPrimary && <span className="ml-2 text-xs text-yellow-600">(Primary)</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">{member.user?.email}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Remove this member from the team?')) {
                        removeMemberMutation.mutate({ teamId: selectedTeam.id, userId: member.userId });
                      }
                    }}
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
