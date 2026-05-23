import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { kbApi } from '../api/client';
import { useCurrentOrganizationId } from '../stores/organizationStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Search, BookOpen, ThumbsUp, ThumbsDown, Eye, Plus, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ModuleErrorHandler } from '../hooks/useModuleGuard';

export function KnowledgeBasePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const organizationId = useCurrentOrganizationId();

  const { data: categories } = useQuery({
    queryKey: ['kb-categories', organizationId],
    queryFn: () => kbApi.categories.tree().then((r) => r.data),
    enabled: !!organizationId,
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  // Render category with hierarchy
  const renderCategory = (category: any, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategory === category.id;

    return (
      <div key={category.id}>
        <div className="flex items-center">
          {hasChildren && (
            <button
              onClick={() => toggleExpand(category.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-transform"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          {!hasChildren && <div className="w-6" />}
          <button
            onClick={() => setSelectedCategory(category.id)}
            className={`flex-1 text-left px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded ${
              isSelected ? 'bg-gray-50 dark:bg-gray-800 font-medium' : ''
            }`}
            style={{ paddingLeft: hasChildren ? '2px' : '2px' }}
          >
            <span className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: category.color || '#6366f1' }}
              />
              {category.name}
              <span className="text-sm text-muted-foreground">
                ({category._count?.articles || 0})
              </span>
            </span>
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {category.children.map((child: any) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ['kb-articles', organizationId, search, selectedCategory],
    queryFn: () =>
      kbApi.articles.list({
        search: search || undefined,
        categoryId: selectedCategory || undefined,
      }).then((r) => r.data),
    retry: false,
    enabled: !!organizationId,
  });

  return (
    <ModuleErrorHandler error={error} moduleName="Knowledge Base">
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Find answers and helpful information</p>
        </div>
        <Button onClick={() => navigate('/knowledge-base/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Article
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-lg"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  !selectedCategory ? 'bg-gray-50 dark:bg-gray-800 font-medium' : ''
                }`}
              >
                All Articles
              </button>
              {categories?.map((category: any) => renderCategory(category))}
            </CardContent>
          </Card>
        </div>

        {/* Articles List */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg" />
              ))}
            </div>
          ) : articles?.items?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No articles found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or browse categories
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {articles?.items?.map((article: any) => (
                <Link key={article.id} to={`/knowledge-base/${article.slug}`}>
                  <Card className="hover:shadow-md transition cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <BookOpen className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <span>{article.category?.name}</span>
                            <span>•</span>
                            <span>{format(new Date(article.publishedAt || article.createdAt), 'MMM d, yyyy')}</span>
                          </div>
                          <h3 className="text-lg font-medium mb-2">{article.title}</h3>
                          <p className="text-muted-foreground line-clamp-2">{article.summary}</p>
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {article.tags.slice(0, 3).map((tag: any) => (
                                <span
                                  key={tag.id}
                                  className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800"
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {article.tags.length > 3 && (
                                <span className="px-2 py-0.5 text-xs text-muted-foreground">
                                  +{article.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              {article.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="w-4 h-4" />
                              {article.helpfulYes}
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsDown className="w-4 h-4" />
                              {article.helpfulNo}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </ModuleErrorHandler>
  );
}
