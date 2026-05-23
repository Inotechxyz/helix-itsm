import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, storageApi, usersApi, teamsApi, categoriesApi, csatApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { FileDropZone } from '../components/ui/FileDropZone';
import { AttachmentPreviewModal } from '../components/ui/AttachmentPreviewModal';
import { Modal } from '../components/ui/Modal';
import { CommentReplyModal } from '../components/tickets/CommentReplyModal';
import { ArrowLeft, Send, Paperclip, Clock, User, Users, Loader2, Star, Inbox, Globe, MessageSquare, Phone, Mail, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/authStore';
import { clsx } from 'clsx';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [assignedAgentId, setAssignedAgentId] = useState<string>('');
  const [assignedTeamId, setAssignedTeamId] = useState<string>('');

  // Dirty state tracking
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

  // Comment state
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  // Attachment state
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<any>(null);

  // CSAT Survey state
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyRating, setSurveyRating] = useState(0);
  const [surveyComment, setSurveyComment] = useState('');
  const [surveySubmitted, setSurveySubmitted] = useState(false);

  // Email Reply Modal state
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState<any>(null);

  // Fetch ticket
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketsApi.get(id!).then((r) => r.data),
  });

  // Check if CSAT survey is already completed
  const existingSurvey = ticket?.csatSurvey;
  const isSurveyCompleted = existingSurvey?.status === 'completed';
  const hasExistingRating = isSurveyCompleted && existingSurvey?.rating;

  // Fetch comments
  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => ticketsApi.getComments(id!).then((r) => r.data),
    enabled: !!id,
  });

  // Fetch categories for selection
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.tree().then((r) => flattenCategories(r.data)),
  });

  // Fetch agents (users)
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () =>
      usersApi.list({ orgRole: 'agent', limit: 100 }).then((r) => r.data.items || []),
  });

  // Fetch teams
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list().then((r) => r.data),
  });

  // Initialize form when ticket loads
  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title || '');
      setDescription(ticket.description || '');
      setPriority(ticket.priority || '');
      setCategoryId(ticket.categoryId || '');
      setAssignedAgentId(ticket.assignedAgentId || '');
      setAssignedTeamId(ticket.assignedTeamId || '');
      setDirtyFields(new Set());
    }
  }, [ticket]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => ticketsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      setDirtyFields(new Set());
    },
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: (data: any) => ticketsApi.assign(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return storageApi.upload(id!, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => storageApi.delete(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      setSelectedAttachment(null);
      setAttachmentToDelete(null);
    },
  });

  // Handle delete attachment - opens confirmation modal
  const handleDeleteAttachment = (attachment: any) => {
    setAttachmentToDelete(attachment);
  };

  // Confirm delete attachment
  const confirmDeleteAttachment = () => {
    if (attachmentToDelete) {
      deleteAttachmentMutation.mutate(attachmentToDelete.id);
    }
  };

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (data: { content: string; isInternal: boolean }) =>
      ticketsApi.addComment(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', id] });
      setComment('');
    },
  });

  // Email reply mutation
  const emailReplyMutation = useMutation({
    mutationFn: (data: {
      content: string;
      recipients: string[];
      originalMessageId?: string;
      originalSubject?: string;
      includeOriginalContent?: boolean;
      originalContent?: string;
    }) => ticketsApi.addComment(id!, {
      content: data.content,
      isInternal: false,
      recipients: data.recipients,
      originalMessageId: data.originalMessageId,
      originalSubject: data.originalSubject,
      includeOriginalContent: data.includeOriginalContent,
      originalContent: data.originalContent,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
    onError: (error: any) => {
      alert('Failed to send email reply. Please try again. Error: ' + (error?.message || 'Unknown error'));
    },
    onSettled: () => {
      setShowReplyModal(false);
    },
  });

  // Handle email reply
  const handleEmailReply = (comment: any) => {
    setSelectedComment(comment);
    setShowReplyModal(true);
  };

  // Transition mutation
  const transitionMutation = useMutation({
    mutationFn: (toStatus: string) =>
      ticketsApi.transition(id!, { toStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  // CSAT Survey mutations
  const submitSurveyMutation = useMutation({
    mutationFn: (data: { rating: number; comment?: string }) =>
      csatApi.submitSurvey(id!, data),
    onSuccess: () => {
      setSurveySubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  // Auto-save handler
  const handleAutoSave = useCallback(
    (field: string, value: any) => {
      if (['title', 'description', 'priority'].includes(field)) {
        updateMutation.mutate({ [field]: value });
      } else if (field === 'categoryId') {
        updateMutation.mutate({ categoryId: value });
      } else if (field === 'assignedAgentId' || field === 'assignedTeamId') {
        assignMutation.mutate({
          agentId: field === 'assignedAgentId' ? value : undefined,
          teamId: field === 'assignedTeamId' ? value : undefined,
        });
      }
    },
    [updateMutation, assignMutation]
  );

  // Handle field blur - save when field loses focus
  const handleBlur = (field: string, value: any) => {
    if (dirtyFields.has(field)) {
      handleAutoSave(field, value);
      setDirtyFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  // Handle field change - only mark as dirty, don't save yet
  const handleChange = (field: string, setter: (value: any) => void, value: any) => {
    setter(value);
    setDirtyFields((prev) => new Set([...prev, field]));
  };

  // Handle file upload with progress tracking
  const handleFilesSelected = async (
    files: File[],
    onProgress: (id: string, progress: number, status: 'uploading' | 'completed' | 'error', error?: string) => void
  ) => {
    try {
      // Create a map to track file IDs
      const fileIdMap = new Map<string, number>();

      // Upload files sequentially with progress tracking
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempId = `temp-${Date.now()}-${i}`;
        fileIdMap.set(tempId, i);

        try {
          // Start uploading
          onProgress(tempId, 0, 'uploading');

          // Use the progress-capable upload function
          await storageApi.uploadWithProgress(
            id!,
            file,
            (percent) => {
              onProgress(tempId, percent, 'uploading');
            }
          );

          // Mark as completed
          onProgress(tempId, 100, 'completed');

          // Invalidate the ticket query to refresh attachments
          queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        } catch (error: any) {
          const errorMessage = error?.message || error?.response?.data?.message || 'Upload failed';
          onProgress(tempId, 0, 'error', errorMessage);
        }
      }
    } finally {
      // Close modal after a short delay to show completion
      setTimeout(() => {
        setShowUploadModal(false);
      }, 1000);
    }
  };

  // Handle submit comment
  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      addCommentMutation.mutate({ content: comment, isInternal });
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/tickets')}>
          Back to Tickets
        </Button>
      </div>
    );
  }

  const isSaving =
    updateMutation.isPending || assignMutation.isPending || uploadMutation.isPending;

  return (
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/tickets')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono">{ticket.ticketNumber}</span>
            <StatusBadge status={ticket.status} />
            {dirtyFields.size > 0 && (
              <span className="flex items-center gap-1 text-sm text-amber-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            )}
          </div>
          {/* Editable Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => handleChange('title', setTitle, e.target.value)}
            onBlur={(e) => handleBlur('title', e.target.value)}
            className={clsx(
              'text-lg text-muted-foreground bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/50 rounded px-1 py-0.5 w-full max-w-2xl',
              dirtyFields.has('title') && 'bg-yellow-50 dark:bg-yellow-900/20'
            )}
          />
        </div>
        <div className="flex gap-2">
          {ticket.status === 'new' && (
            <Button onClick={() => transitionMutation.mutate('assigned')}>
              Accept
            </Button>
          )}
          {ticket.status === 'assigned' && (
            <Button onClick={() => transitionMutation.mutate('in_progress')}>
              Start Work
            </Button>
          )}
          {(ticket.status === 'in_progress' || ticket.status === 'pending') && (
            <Button onClick={() => transitionMutation.mutate('resolved')}>
              Mark Resolved
            </Button>
          )}
          {ticket.status === 'resolved' && (
            <Button onClick={() => transitionMutation.mutate('closed')}>
              Close Ticket
            </Button>
          )}
          {(ticket.status === 'resolved' || ticket.status === 'closed') && (
            hasExistingRating ? (
              <button
                type="button"
                onClick={() => setShowSurveyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= existingSurvey.rating
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Rated - Click to view
                </span>
              </button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSurveyRating(0);
                  setSurveyComment('');
                  setSurveySubmitted(false);
                  setShowSurveyModal(true);
                }}
                className="gap-2"
              >
                <Star className="w-4 h-4" />
                Rate Experience
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={description}
                onChange={(e) => handleChange('description', setDescription, e.target.value)}
                onBlur={(e) => handleBlur('description', e.target.value)}
                rows={6}
                className={clsx(
                  dirtyFields.has('description') && 'bg-yellow-50 dark:bg-yellow-900/20'
                )}
                placeholder="Enter ticket description..."
              />
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attachments ({ticket.attachments?.length || 0})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowUploadModal(true)}>
                <Paperclip className="w-4 h-4 mr-1" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {ticket.attachments?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {ticket.attachments.map((attachment: any) => (
                    <div
                      key={attachment.id}
                      className="flex flex-col items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800 relative group hover:bg-gray-100 dark:hover:bg-gray-700 transition border border-gray-200 dark:border-gray-700"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAttachment(attachment);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete attachment"
                        disabled={deleteAttachmentMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div
                        onClick={() => setSelectedAttachment(attachment)}
                        className="flex flex-col items-center cursor-pointer"
                      >
                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center mb-2">
                          <Paperclip className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                        </div>
                        <span className="text-xs text-center truncate w-full" title={attachment.originalName}>
                          {attachment.originalName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.fileSize)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No attachments
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Comments ({comments?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(comments?.slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || []).map((comment: any) => (
                <div
                  key={comment.id}
                  className={clsx(
                    'p-4 rounded-lg',
                    comment.isInternal
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200'
                      : 'bg-gray-50 dark:bg-gray-800'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {comment.author?.firstName} {comment.author?.lastName}
                      </span>
                      {comment.isInternal && (
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">
                          Internal
                        </span>
                      )}
                      {comment.channel === 'email' && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          <Mail className="w-3 h-3" />
                          Email
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {comment.channel === 'email' && comment.replyToAddresses && (
                        <button
                          type="button"
                          onClick={() => handleEmailReply(comment)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" />
                          Reply via Email
                        </button>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap">{comment.content}</p>
                  {comment.replyToAddresses && (
                    <p className="text-xs text-muted-foreground mt-2">
                      To: {comment.replyToAddresses}
                    </p>
                  )}
                </div>
              ))}

              {/* Add Comment */}
              <form onSubmit={handleSubmitComment} className="mt-4 space-y-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded"
                    />
                    Internal note (only visible to agents)
                  </label>
                  <Button
                    type="submit"
                    disabled={!comment.trim() || addCommentMutation.isPending}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Channel */}
              <div className="flex items-center gap-3">
                {ticket.channel === 'email' && <Inbox className="w-4 h-4 text-muted-foreground" />}
                {ticket.channel === 'portal' && <Globe className="w-4 h-4 text-muted-foreground" />}
                {ticket.channel === 'chat' && <MessageSquare className="w-4 h-4 text-muted-foreground" />}
                {ticket.channel === 'phone' && <Phone className="w-4 h-4 text-muted-foreground" />}
                {(!ticket.channel || !['email', 'portal', 'chat', 'phone'].includes(ticket.channel)) && <Inbox className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm text-muted-foreground">Channel</p>
                  <p className="font-medium capitalize">{ticket.channel || 'Email'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Requester</p>
                  <p className="font-medium">
                    {ticket.requester?.firstName} {ticket.requester?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{ticket.requester?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>

              {ticket.slaDeadline && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">SLA Deadline</p>
                    <p className={ticket.slaBreached ? 'text-red-600 font-medium' : ''}>
                      {format(new Date(ticket.slaDeadline), 'MMM d, yyyy h:mm a')}
                      {ticket.slaBreached && ' (Breached)'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Priority */}
          <Card>
            <CardHeader>
              <CardTitle>Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={priority}
                onChange={(e) => handleChange('priority', setPriority, e.target.value)}
                onBlur={(e) => handleBlur('priority', e.target.value)}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'critical', label: 'Critical' },
                ]}
                className={clsx(
                  dirtyFields.has('priority') && 'bg-yellow-50 dark:bg-yellow-900/20'
                )}
              />
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Assigned Agent"
                value={assignedAgentId}
                onChange={(e) => handleChange('assignedAgentId', setAssignedAgentId, e.target.value)}
                onBlur={(e) => handleBlur('assignedAgentId', e.target.value)}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(agents?.map((a: any) => ({
                    value: a.id,
                    label: `${a.firstName} ${a.lastName}`,
                  })) || []),
                ]}
                placeholder="Select agent..."
                className={clsx(
                  dirtyFields.has('assignedAgentId') && 'bg-yellow-50 dark:bg-yellow-900/20'
                )}
              />

              <Select
                label="Assigned Team"
                value={assignedTeamId}
                onChange={(e) => handleChange('assignedTeamId', setAssignedTeamId, e.target.value)}
                onBlur={(e) => handleBlur('assignedTeamId', e.target.value)}
                options={[
                  { value: '', label: 'No Team' },
                  ...(teams?.map((t: any) => ({
                    value: t.id,
                    label: t.name,
                  })) || []),
                ]}
                placeholder="Select team..."
                className={clsx(
                  dirtyFields.has('assignedTeamId') && 'bg-yellow-50 dark:bg-yellow-900/20'
                )}
              />
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader>
              <CardTitle>Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={categoryId}
                onChange={(e) => handleChange('categoryId', setCategoryId, e.target.value)}
                onBlur={(e) => handleBlur('categoryId', e.target.value)}
                options={
                  categories?.map((c: any) => ({
                    value: c.id,
                    label: c.parentId ? `${'--'.repeat(c.depth || 1)} ${c.name}` : c.name,
                  })) || []
                }
                placeholder="Select category..."
                className={clsx(
                  dirtyFields.has('categoryId') && 'bg-yellow-50 dark:bg-yellow-900/20'
                )}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      <AttachmentPreviewModal
        attachment={selectedAttachment}
        onClose={() => setSelectedAttachment(null)}
      />

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Attachments"
        size="lg"
      >
        <FileDropZone
          onFilesSelected={handleFilesSelected}
          accept="*/*"
          maxSize={25 * 1024 * 1024}
          maxFiles={10}
          disabled={uploading}
        />
        {uploading && (
          <div className="flex items-center justify-center mt-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Uploading files...
          </div>
        )}
      </Modal>

      {/* Delete Attachment Confirmation Modal */}
      <Modal
        isOpen={!!attachmentToDelete}
        onClose={() => setAttachmentToDelete(null)}
        title="Delete Attachment"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to delete the attachment <strong>"{attachmentToDelete?.originalName}"</strong>?
          </p>
          <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setAttachmentToDelete(null)}
              disabled={deleteAttachmentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteAttachment}
              disabled={deleteAttachmentMutation.isPending}
            >
              {deleteAttachmentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CSAT Survey Modal */}
      <Modal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        title="Rate Your Experience"
      >
        {isSurveyCompleted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-green-600 fill-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Thank you for your feedback!</h3>
            <p className="text-muted-foreground mb-4">
              You rated this ticket with:
            </p>
            <div className="flex items-center justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-6 h-6 ${
                    star <= (existingSurvey?.rating || 0)
                      ? 'text-yellow-500 fill-yellow-500'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            {existingSurvey?.comment && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm font-medium mb-1">Your comment:</p>
                <p className="text-muted-foreground">{existingSurvey.comment}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-4">
              Submitted on {existingSurvey?.completedAt ? format(new Date(existingSurvey.completedAt), 'MMM d, yyyy') : 'N/A'}
            </p>
            <Button onClick={() => setShowSurveyModal(false)}>Close</Button>
          </div>
        ) : surveySubmitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-green-600 fill-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
            <p className="text-muted-foreground mb-4">
              Your feedback helps us improve our service.
            </p>
            <div className="flex items-center justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-6 h-6 ${
                    star <= surveyRating
                      ? 'text-yellow-500 fill-yellow-500'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <Button onClick={() => setShowSurveyModal(false)}>Done</Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (surveyRating > 0) {
                submitSurveyMutation.mutate({
                  rating: surveyRating,
                  comment: surveyComment || undefined,
                });
              }
            }}
            className="space-y-6"
          >
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                How satisfied were you with the support you received for this ticket?
              </p>
              <div className="flex items-center justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSurveyRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        star <= surveyRating
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {surveyRating === 0 && 'Click to rate'}
                {surveyRating === 1 && 'Poor'}
                {surveyRating === 2 && 'Fair'}
                {surveyRating === 3 && 'Good'}
                {surveyRating === 4 && 'Very Good'}
                {surveyRating === 5 && 'Excellent'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Additional Comments (Optional)
              </label>
              <Textarea
                value={surveyComment}
                onChange={(e) => setSurveyComment(e.target.value)}
                placeholder="Tell us more about your experience..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSurveyModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={surveyRating === 0 || submitSurveyMutation.isPending}
              >
                {submitSurveyMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Email Reply Modal */}
      <CommentReplyModal
        isOpen={showReplyModal}
        onClose={() => setShowReplyModal(false)}
        comment={selectedComment}
        isLoading={emailReplyMutation.isPending}
        onSubmit={(data) => {
          emailReplyMutation.mutate({
            content: data.content,
            recipients: data.recipients,
            originalMessageId: selectedComment?.originalMessageId,
            originalSubject: selectedComment?.originalSubject,
            includeOriginalContent: data.includeOriginalContent,
            originalContent: data.originalContent,
          });
        }}
      />
    </div>
  );
}

// Helper to flatten categories for select
function flattenCategories(categories: any[], depth = 0, result: any[] = []): any[] {
  for (const category of categories) {
    result.push({ ...category, depth });
    if (category.children?.length > 0) {
      flattenCategories(category.children, depth + 1, result);
    }
  }
  return result;
}
