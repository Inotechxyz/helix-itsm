import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { User, Search } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { useCurrentOrganizationId } from '../stores/organizationStore';

const roleColors: Record<string, string> = {
  superadmin: 'bg-red-100 text-red-800',
  manager: 'bg-purple-100 text-purple-800',
  agent: 'bg-blue-100 text-blue-800',
  approver: 'bg-yellow-100 text-yellow-800',
  requester: 'bg-gray-100 text-gray-800',
};

export function UsersPage() {
  const organizationId = useCurrentOrganizationId();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', organizationId],
    queryFn: () => usersApi.list().then((r) => r.data),
    enabled: !!organizationId,
  });

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage user accounts and roles</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search users..." className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : users?.items?.length === 0 ? (
            <div className="p-8 text-center">
              <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="divide-y">
              {users?.items?.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${roleColors[user.role] || roleColors.requester}`}>
                      {user.role}
                    </span>
                    {user.teams?.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {user.teams.map((t: any) => t.team.name).join(', ')}
                      </span>
                    )}
                    <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
