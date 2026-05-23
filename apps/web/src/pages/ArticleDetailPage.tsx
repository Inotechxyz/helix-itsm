import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { kbApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { ArrowLeft, ThumbsUp, ThumbsDown, BookOpen, Clock, Edit } from 'lucide-react';
import { format } from 'date-fns';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: article, isLoading } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => kbApi.articles.get(slug!).then((r) => r.data),
  });

  const feedbackMutation = useMutation({
    mutationFn: (helpful: boolean) => kbApi.articles.feedback(article?.id!, helpful),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', slug] });
    },
  });

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (!article) {
    return <div>Article not found</div>;
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/knowledge-base"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Knowledge Base
        </Link>
        <Button
          variant="outline"
          onClick={() => navigate(`/knowledge-base/${slug}/edit`)}
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Article
        </Button>
      </div>

      <article>
        <header className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <BookOpen className="w-4 h-4" />
            <span>{article.category?.name}</span>
            <span>•</span>
            <span>{format(new Date(article.publishedAt || article.createdAt), 'MMMM d, yyyy')}</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
          {article.summary && (
            <p className="text-xl text-muted-foreground">{article.summary}</p>
          )}
        </header>

        <Card>
          <CardContent className="p-8">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {article.content}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        {article.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6">
            {article.tags.map((tag: any) => (
              <span
                key={tag.id}
                className="px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-800"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Feedback */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Was this article helpful?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => feedbackMutation.mutate(true)}
                disabled={feedbackMutation.isPending}
              >
                <ThumbsUp className="w-4 h-4 mr-2" />
                Yes ({article.helpfulYes})
              </Button>
              <Button
                variant="outline"
                onClick={() => feedbackMutation.mutate(false)}
                disabled={feedbackMutation.isPending}
              >
                <ThumbsDown className="w-4 h-4 mr-2" />
                No ({article.helpfulNo})
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              <Clock className="w-4 h-4 inline mr-1" />
              Last updated {format(new Date(article.updatedAt), 'MMMM d, yyyy')}
            </p>
          </CardContent>
        </Card>
      </article>
    </div>
    </div>
  );
}
