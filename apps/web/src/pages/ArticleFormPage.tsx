import { useState, useEffect, KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { kbApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { showToast } from '../components/ui/Toast';
import { ArrowLeft, Eye, Edit, Save, Send, X } from 'lucide-react';

export function ArticleFormPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const isEditing = !!slug;
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    content: '',
    categoryId: '',
    tagIds: [] as string[],
  });
  const [preview, setPreview] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  const placeholder = `# Article Title

Write your article content here using Markdown...

## Section Heading

- List item 1
- List item 2

**Bold text** and *italic text*

\`\`\`
Code block
\`\`\``;

  const { data: categories } = useQuery({
    queryKey: ['kb-categories'],
    queryFn: () => kbApi.categories.list().then((r) => r.data),
  });

  const { data: tags } = useQuery({
    queryKey: ['kb-tags'],
    queryFn: () => kbApi.tags.list().then((r) => r.data),
  });

  const { data: article, isLoading: loadingArticle } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => kbApi.articles.get(slug!).then((r) => r.data),
    enabled: isEditing,
  });

  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title || '',
        summary: article.summary || '',
        content: article.content || '',
        categoryId: article.categoryId || '',
        tagIds: article.tags?.map((t: any) => t.id) || [],
      });
      setSelectedTags(article.tags?.map((t: any) => t.id) || []);
    }
  }, [article]);

  const createMutation = useMutation({
    mutationFn: (data: any) => kbApi.articles.create(data),
    onSuccess: () => {
      showToast('Article created successfully!', 'success');
      navigate('/app/knowledge-base');
    },
    onError: () => showToast('Failed to create article', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => kbApi.articles.update(id, data),
    onSuccess: () => {
      showToast('Article updated successfully!', 'success');
      navigate(`/knowledge-base/${slug}`);
    },
    onError: () => showToast('Failed to update article', 'error'),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      // First save the article
      let savedArticle;
      if (isEditing && article) {
        await updateMutation.mutateAsync({ id: article.id, data: formData });
        savedArticle = article;
      } else {
        const result = await createMutation.mutateAsync(formData);
        savedArticle = result.data;
      }
      return savedArticle;
    },
    onSuccess: async (savedArticle) => {
      // Then publish it
      await kbApi.articles.publish(savedArticle.id);
      showToast('Article published successfully!', 'success');
      navigate(`/knowledge-base/${savedArticle.slug}`);
    },
    onError: () => showToast('Failed to publish article', 'error'),
  });

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string }) =>
      kbApi.tags.create(data),
    onSuccess: (response) => {
      const newTag = response.data;
      queryClient.invalidateQueries({ queryKey: ['kb-tags'] });
      // Add the new tag to selected tags
      const newTags = [...selectedTags, newTag.id];
      setSelectedTags(newTags);
      setFormData({ ...formData, tagIds: newTags });
      showToast(`Tag "${newTag.name}" created and added`, 'success');
    },
    onError: () => showToast('Failed to create tag', 'error'),
  });

  const handleAddTag = () => {
    const tagName = newTagInput.trim().toLowerCase();
    if (!tagName) return;

    // Check if tag already exists
    const existingTag = tags?.find((t: any) => t.name.toLowerCase() === tagName);
    if (existingTag) {
      // Add existing tag if not already selected
      if (!selectedTags.includes(existingTag.id)) {
        const newTags = [...selectedTags, existingTag.id];
        setSelectedTags(newTags);
        setFormData({ ...formData, tagIds: newTags });
        showToast(`Tag "${existingTag.name}" added`, 'success');
      } else {
        showToast('Tag already selected', 'info');
      }
    } else {
      // Create new tag
      createTagMutation.mutate({ name: tagName });
    }
    setNewTagInput('');
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagId: string) => {
    const newTags = selectedTags.filter((id) => id !== tagId);
    setSelectedTags(newTags);
    setFormData({ ...formData, tagIds: newTags });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && article) {
      updateMutation.mutate({ id: article.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePublish = () => {
    if (!formData.title) {
      showToast('Please enter a title before publishing', 'error');
      return;
    }
    publishMutation.mutate();
  };

  const toggleTag = (tagId: string) => {
    const newTags = selectedTags.includes(tagId)
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId];
    setSelectedTags(newTags);
    setFormData({ ...formData, tagIds: newTags });
  };

  if (isEditing && loadingArticle) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/app/knowledge-base')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{isEditing ? 'Edit Article' : 'Create Article'}</h1>
            <p className="text-muted-foreground">Write in Markdown format</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPreview(!preview)}
          >
            {preview ? <Edit className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button
            variant="outline"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishMutation.isPending}
          >
            <Send className="w-4 h-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <Input
                  label="Title"
                  placeholder="Article title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
                <Input
                  label="Summary"
                  placeholder="Brief description of the article"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Content (Markdown)</CardTitle>
                  <div className="text-sm text-muted-foreground">
                    Supports: **bold**, *italic*, `code`, [links](url), lists, tables, and more
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {preview ? (
                  <div className="p-6 prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {formData.content || '*No content yet...*'}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <textarea
                    className="w-full h-96 p-6 font-mono text-sm border-0 focus:ring-0 resize-y bg-transparent"
                    placeholder={placeholder}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border bg-background"
                    required
                  >
                    <option value="">Select category...</option>
                    {categories?.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tags</label>

                  {/* Selected tags with remove buttons */}
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedTags.map((tagId) => {
                        const tag = tags?.find((t: any) => t.id === tagId);
                        return (
                          <span
                            key={tagId}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary text-primary-foreground"
                          >
                            {tag?.name || 'Tag'}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tagId)}
                              className="hover:bg-primary-foreground/20 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline tag input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="Type tag name and press Enter"
                      className="flex-1 px-3 py-2 text-sm rounded-md border bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTag}
                      disabled={!newTagInput.trim() || createTagMutation.isPending}
                    >
                      Add
                    </Button>
                  </div>

                  {/* Existing tags to select from */}
                  {tags && tags.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-2">Or select existing tags:</p>
                      <div className="flex flex-wrap gap-2">
                        {tags
                          .filter((tag: any) => !selectedTags.includes(tag.id))
                          .map((tag: any) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              className="px-2 py-1 text-xs rounded-full border bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                              + {tag.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Markdown Guide</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div><code className="bg-gray-100 px-1"># Heading 1</code></div>
                <div><code className="bg-gray-100 px-1">## Heading 2</code></div>
                <div><code className="bg-gray-100 px-1">**bold**</code></div>
                <div><code className="bg-gray-100 px-1">*italic*</code></div>
                <div><code className="bg-gray-100 px-1">`code`</code></div>
                <div><code className="bg-gray-100 px-1">[link](url)</code></div>
                <div><code className="bg-gray-100 px-1">- list item</code></div>
                <div><code className="bg-gray-100 px-1">1. numbered</code></div>
                <div><code className="bg-gray-100 px-1">{"&gt;"} quote</code></div>
                <div><code className="bg-gray-100 px-1">{"```"} code block {"```"}</code></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
    </div>
  );
}
