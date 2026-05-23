import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Users } from 'lucide-react';

const teamTypeColors: Record<string, string> = {
  first_line: 'bg-green-100 text-green-800',
  second_line: 'bg-yellow-100 text-yellow-800',
  third_line: 'bg-red-100 text-red-800',
};

export function TeamsPage() {
  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list().then((r) => r.data),
  });

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      <div>
        <h1 className="text-3xl font-bold">Teams</h1>
        <p className="text-muted-foreground">Manage support teams and their members</p>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg" />
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
                  <CardTitle>{team.name}</CardTitle>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${teamTypeColors[team.type] || ''}`}>
                    {team.type.replace(/_/g, ' ')}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {team.description && (
                  <p className="text-sm text-muted-foreground mb-4">{team.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{team._count?.members || 0} members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {team._count?.tickets || 0} tickets
                    </span>
                  </div>
                </div>
                {team.lead && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Team Lead</p>
                    <p className="font-medium">
                      {team.lead.firstName} {team.lead.lastName}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
