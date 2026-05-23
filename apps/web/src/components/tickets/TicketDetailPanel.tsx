import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ticketsApi, storageApi, usersApi, teamsApi, categoriesApi, csatApi } from '../../api/client';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { AttachmentPreviewModal } from '../ui/AttachmentPreviewModal';
import { Modal } from '../ui/Modal';
import { FileDropZone } from '../ui/FileDropZone';
import { Send, Paperclip, Clock, User, Loader2, Star, X, ChevronLeft, ChevronRight, ExternalLink, Inbox, Globe, MessageSquare, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';

interface TicketDetailPanelProps {
  ticketId: string | null;
  tickets: any[];
  onClose?: () => void;
  onSelectTicket?: (ticketId: string) => void;
}

export function TicketDetailPanel({ ticketId, tickets, onClose, onSelectTicket }: TicketDetailPanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [assignedAgentId, setAssignedAgentId] = useState<string>('');
  const [assignedTeamId, setAssignedTeamId] = useState<string>('');

  // Dirty state tracking
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Comment state
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  // Attachment state
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // CSAT Survey state
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyRating, setSurveyRating] = useState(0);
  const [surveyComment, setSurveyComment] = useState('');
  const [surveySubmitted, setSurveySubmitted] = useState(false);

  // Fetch ticket
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketsApi.get(ticketId!).then((r) => r.data),
    enabled: !!ticketId,
  });

  // Fetch comments
  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: () => ticketsApi.getComments(ticketId!).then((r) => r.data),
    enabled: !!ticketId,
  });

  // Fetch categories for selection
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.tree().then((r) => r.data),
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
    mutationFn: (data: any) => ticketsApi.update(ticketId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setDirtyFields(new Set());
    },
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: (data: any) => ticketsApi.assign(ticketId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return storageApi.upload(ticketId!, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (data: { content: string; isInternal: boolean }) =>
      ticketsApi.addComment(ticketId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
      setComment('');
    },
  });

  // Transition mutation
  const transitionMutation = useMutation({
    mutationFn: (toStatus: string) =>
      ticketsApi.transition(ticketId!, { toStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  // CSAT Survey mutations
  const submitSurveyMutation = useMutation({
    mutationFn: (data: { rating: number; comment?: string }) =>
      csatApi.submitSurvey(ticketId!, data),
    onSuccess: () => {
      setSurveySubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  // Auto-save handler
  const handleAutoSave = useCallback(
    (field: string, value: any) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setDirtyFields((prev) => new Set([...prev, field]));

      saveTimeoutRef.current = setTimeout(() => {
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
      }, 500);
    },
    [updateMutation, assignMutation]
  );

  // Handle field blur
  const handleBlur = (field: string, value: any) => {
    if (dirtyFields.has(field)) {
      handleAutoSave(field, value);
    }
  };

  // Handle file upload with progress tracking
  const handleFilesSelected = async (
    files: File[],
    onProgress: (id: string, progress: number, status: 'uploading' | 'completed' | 'error', error?: string) => void
  ) => {
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempId = `temp-${Date.now()}-${i}`;
        try {
          onProgress(tempId, 0, 'uploading');
          await storageApi.uploadWithProgress(
            ticketId!,
            file,
            (percent) => onProgress(tempId, percent, 'uploading')
          );
          onProgress(tempId, 100, 'completed');
          queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
        } catch (error: any) {
          const errorMessage = error?.response?.data?.message || error?.message || 'Upload failed';
          onProgress(tempId, 0, 'error', errorMessage);
        }
      }
    } finally {
      setTimeout(() => setShowUploadModal(false), 1000);
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

  // CSAT state
  const existingSurvey = ticket?.csatSurvey;
  const isSurveyCompleted = existingSurvey?.status === 'completed';
  const hasExistingRating = isSurveyCompleted && existingSurvey?.rating;

  // Get current ticket index for navigation
  const currentIndex = tickets.findIndex((t) => t.id === ticketId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < tickets.length - 1;

  const handlePrevTicket = () => {
    if (hasPrev && onSelectTicket) {
      const prevTicket = tickets[currentIndex - 1];
      onSelectTicket(prevTicket.id);
    }
  };

  const handleNextTicket = () => {
    if (hasNext && onSelectTicket) {
      const nextTicket = tickets[currentIndex + 1];
      onSelectTicket(nextTicket.id);
    }
  };

  const handleOpenFullView = () => {
    if (ticketId) {
      navigate(`/tickets/${ticketId}`);
    }
  };

  if (!ticketId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p>Select a ticket to view details</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Ticket not found</p>
      </div>
    );
  }

  const isSaving =
    updateMutation.isPending || assignMutation.isPending || uploadMutation.isPending;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header - Compact */}
      <div className="flex-shrink-0 border-b bg-background px-3 py-2">
        {/* Top row: Badges, Navigation, Actions */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="font-mono text-xs text-muted-foreground">
              {ticket.ticketNumber}
            </span>
            {/* Channel Badge */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-muted-foreground border border-gray-200 dark:border-gray-700">
              {ticket.channel === 'email' && <Inbox className="w-3 h-3" />}
              {ticket.channel === 'portal' && <Globe className="w-3 h-3" />}
              {ticket.channel === 'chat' && <MessageSquare className="w-3 h-3" />}
              {ticket.channel === 'phone' && <Phone className="w-3 h-3" />}
              {(!ticket.channel || !['email', 'portal', 'chat', 'phone'].includes(ticket.channel)) && <Inbox className="w-3 h-3" />}
              <span className="capitalize">{ticket.channel || 'Email'}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Action buttons */}
            {ticket.status === 'new' && (
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => transitionMutation.mutate('assigned')}>
                Accept
              </Button>
            )}
            {ticket.status === 'assigned' && (
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => transitionMutation.mutate('in_progress')}>
                Start
              </Button>
            )}
            {(ticket.status === 'in_progress' || ticket.status === 'pending') && (
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => transitionMutation.mutate('resolved')}>
                Resolve
              </Button>
            )}
            {ticket.status === 'resolved' && (
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => transitionMutation.mutate('closed')}>
                Close
              </Button>
            )}
            {(ticket.status === 'resolved' || ticket.status === 'closed') && (
              hasExistingRating ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSurveyModal(true)}
                  className="h-7 px-2 gap-1"
                >
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSurveyRating(0);
                    setSurveyComment('');
                    setSurveySubmitted(false);
                    setShowSurveyModal(true);
                  }}
                  className="h-7 px-2 gap-1"
                >
                  <Star className="w-3 h-3" />
                </Button>
              )
            )}
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
            {/* Navigation buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevTicket}
              disabled={!hasPrev}
              className="p-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-1">
              {currentIndex + 1}/{tickets.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextTicket}
              disabled={!hasNext}
              className="p-1"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            {/* Open Full View button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenFullView}
              className="p-1"
              title="Open in full view"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="p-1">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            handleAutoSave('title', e.target.value);
          }}
          onBlur={(e) => handleBlur('title', e.target.value)}
          className={clsx(
            'w-full text-base font-semibold bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/50 rounded px-1 py-0.5',
            dirtyFields.has('title') && 'bg-yellow-50 dark:bg-yellow-900/20'
          )}
        />
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Description */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                handleAutoSave('description', e.target.value);
              }}
              onBlur={(e) => handleBlur('description', e.target.value)}
              rows={3}
              className={clsx(
                'w-full text-sm',
                dirtyFields.has('description') && 'bg-yellow-50 dark:bg-yellow-900/20'
              )}
              placeholder="Enter ticket description..."
            />
          </CardContent>
        </Card>

        {/* Requester and Created */}
        <div className="grid grid-cols-2 gap-3">
          {/* Requester */}
          <Card>
            <CardContent className="pt-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div className="text-sm min-w-0">
                  <p className="font-medium truncate">
                    {ticket.requester?.firstName} {ticket.requester?.lastName}
                  </p>
                  <p className="text-muted-foreground text-xs truncate">{ticket.requester?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Created */}
          <Card>
            <CardContent className="pt-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assignment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assignment</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <Select
              label="Agent"
              value={assignedAgentId}
              onChange={(e) => {
                setAssignedAgentId(e.target.value);
                handleAutoSave('assignedAgentId', e.target.value);
              }}
              onBlur={(e) => handleBlur('assignedAgentId', e.target.value)}
              options={[
                { value: '', label: 'Unassigned' },
                ...(agents?.map((a: any) => ({
                  value: a.id,
                  label: `${a.firstName} ${a.lastName}`,
                })) || []),
              ]}
              className={clsx(
                dirtyFields.has('assignedAgentId') && 'bg-yellow-50 dark:bg-yellow-900/20'
              )}
            />
            <Select
              label="Team"
              value={assignedTeamId}
              onChange={(e) => {
                setAssignedTeamId(e.target.value);
                handleAutoSave('assignedTeamId', e.target.value);
              }}
              onBlur={(e) => handleBlur('assignedTeamId', e.target.value)}
              options={[
                { value: '', label: 'No Team' },
                ...(teams?.map((t: any) => ({
                  value: t.id,
                  label: t.name,
                })) || []),
              ]}
              className={clsx(
                dirtyFields.has('assignedTeamId') && 'bg-yellow-50 dark:bg-yellow-900/20'
              )}
            />
          </CardContent>
        </Card>

        {/* Priority */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Priority</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                handleAutoSave('priority', e.target.value);
              }}
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

        {/* Attachments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">
              Attachments ({ticket.attachments?.length || 0})
            </CardTitle>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setShowUploadModal(true)}
              className="h-6"
            >
              <Paperclip className="w-3 h-3 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {ticket.attachments?.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {ticket.attachments.map((attachment: any) => (
                  <div
                    key={attachment.id}
                    onClick={() => setSelectedAttachment(attachment)}
                    className="flex flex-col items-center p-1.5 rounded bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition border border-gray-200 dark:border-gray-700"
                  >
                    <Paperclip className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-xs text-center truncate w-full" title={attachment.originalName}>
                      {attachment.originalName}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No attachments</p>
            )}
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Comments ({comments?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {comments?.slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((comment: any) => (
              <div
                key={comment.id}
                className={clsx(
                  'p-2 rounded-lg text-sm',
                  comment.isInternal
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200'
                    : 'bg-gray-50 dark:bg-gray-800'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">
                      {comment.author?.firstName} {comment.author?.lastName}
                    </span>
                    {comment.isInternal && (
                      <span className="text-xs px-1 py-0.5 rounded bg-yellow-100 text-yellow-800">
                        Internal
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-xs">{comment.content}</p>
              </div>
            ))}

            {/* Add Comment */}
            <form onSubmit={handleSubmitComment} className="mt-2 space-y-1">
              <Textarea
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="text-xs"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded"
                  />
                  Internal note
                </label>
                <Button
                  type="submit"
                  size="xs"
                  disabled={!comment.trim() || addCommentMutation.isPending}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Send
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
        <div className="p-2">
          <FileDropZone
            onFilesSelected={handleFilesSelected}
            maxSize={25 * 1024 * 1024} // 25MB max
            maxFiles={10}
          />
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
    </div>
  );
}
