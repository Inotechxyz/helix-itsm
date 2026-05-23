import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kbApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tooltip } from '../../components/ui/Tooltip';
import { showToast } from '../../components/ui/Toast';
import { Brain, RefreshCw, CheckCircle, XCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';

interface EmbeddingStatus {
  hasEmbedding: boolean;
  chunkCount: number;
  articleId: string;
}

interface ArticleWithEmbedding {
  id: string;
  title: string;
  slug: string;
  status: string;
  category?: { name: string };
  embedding?: EmbeddingStatus;
}

export function AdminEmbeddingsPage() {
  const queryClient = useQueryClient();
  const organizationId = useCurrentOrganizationId();
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState<{ processed: number; total: number } | null>(null);

  // Fetch KB stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['kb-stats', organizationId],
    queryFn: () => kbApi.stats().then((r) => r.data),
    enabled: !!organizationId,
  });

  // Fetch published articles
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['kb-articles-embeddings', organizationId],
    queryFn: () => kbApi.articles.list({ status: 'published', limit: 100 }).then((r) => r.data),
    enabled: !!organizationId,
  });

  // Fetch embedding statuses for articles
  const { data: embeddingStatuses, isLoading: embeddingLoading, refetch: refetchEmbeddings } = useQuery({
    queryKey: ['kb-embedding-statuses', organizationId],
    queryFn: async () => {
      if (!articles?.items) return [];

      const statuses: EmbeddingStatus[] = [];
      // Fetch in batches to avoid too many requests
      for (const article of articles.items) {
        try {
          const response = await kbApi.embeddings.getStatus(article.id);
          statuses.push(response.data);
        } catch {
          // Article might not have embedding
          statuses.push({
            hasEmbedding: false,
            chunkCount: 0,
            articleId: article.id,
          });
        }
      }
      return statuses;
    },
    enabled: !!articles?.items && articles.items.length > 0,
    // Only refetch manually
    staleTime: Infinity,
  });

  // Rebuild embeddings mutation
  const rebuildMutation = useMutation({
    mutationFn: () => kbApi.embeddings.rebuild(),
    onSuccess: (response) => {
      const result = response.data;
      if (result.errors && result.errors.length > 0) {
        showToast(`Rebuilt ${result.articlesProcessed} articles with ${result.errors.length} errors`, 'info');
      } else {
        showToast(`Successfully rebuilt ${result.articlesProcessed} article embeddings`, 'success');
      }
      setIsRebuilding(false);
      setRebuildProgress(null);
      queryClient.invalidateQueries({ queryKey: ['kb-embedding-statuses'] });
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to rebuild embeddings', 'error');
      setIsRebuilding(false);
      setRebuildProgress(null);
    },
  });

  const handleRebuildAll = async () => {
    if (!confirm('Are you sure you want to rebuild all embeddings? This may take a while.')) {
      return;
    }
    setIsRebuilding(true);
    rebuildMutation.mutate();
  };

  // Combine articles with embedding statuses
  const articlesWithEmbeddings: ArticleWithEmbedding[] = articles?.items?.map((article: any) => {
    const embeddingStatus = embeddingStatuses?.find((e: EmbeddingStatus) => e.articleId === article.id);
    return {
      ...article,
      embedding: embeddingStatus,
    };
  }) || [];

  // Calculate stats
  const totalArticles = stats?.published || 0;
  const embeddedArticles = embeddingStatuses?.filter((e: EmbeddingStatus) => e.hasEmbedding).length || 0;
  const totalChunks = embeddingStatuses?.reduce((sum: number, e: EmbeddingStatus) => sum + e.chunkCount, 0) || 0;

  const statsCards = [
    {
      title: 'Total Published',
      value: totalArticles,
      icon: FileText,
      color: 'text-blue-600',
    },
    {
      title: 'With Embeddings',
      value: embeddedArticles,
      icon: CheckCircle,
      color: 'text-green-600',
    },
    {
      title: 'Total Chunks',
      value: totalChunks,
      icon: Brain,
      color: 'text-purple-600',
    },
    {
      title: 'Missing Embeddings',
      value: totalArticles - embeddedArticles,
      icon: AlertCircle,
      color: totalArticles - embeddedArticles > 0 ? 'text-red-600' : 'text-green-600',
    },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Article Embeddings</h1>
          <p className="text-muted-foreground">Manage Knowledge Base article embeddings for semantic search</p>
        </div>
        <Button
          onClick={handleRebuildAll}
          disabled={isRebuilding || articlesLoading || embeddingLoading}
          variant="default"
        >
          {isRebuilding ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Rebuilding...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Rebuild All Embeddings
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            About Semantic Search
          </CardTitle>
          <CardDescription className="text-blue-700">
            Article embeddings enable semantic search, allowing users to find articles by meaning rather than just keywords.
            Each article is split into chunks (default: 500 words each) with overlapping content for better context.
            The chatbot uses these embeddings to provide relevant article suggestions.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Articles List */}
      <Card>
        <CardHeader>
          <CardTitle>Articles with Embedding Status</CardTitle>
          <CardDescription>
            Shows which published articles have embeddings generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          {articlesLoading || embeddingLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : articlesWithEmbeddings.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No published articles found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Article</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Chunks</th>
                  </tr>
                </thead>
                <tbody>
                  {articlesWithEmbeddings.map((article) => (
                    <tr key={article.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{article.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {article.category?.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {article.embedding?.hasEmbedding ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Embedded
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="w-3 h-3" />
                            Missing
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm">
                          {article.embedding?.chunkCount || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}