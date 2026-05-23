import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { Loader2, Mail, Plus, X } from 'lucide-react';

interface CommentReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  comment: {
    id: string;
    author: {
      firstName: string;
      lastName: string;
    };
    content: string;
    replyToAddresses?: string | null;
    originalSubject?: string | null;
    originalMessageId?: string | null;
  } | null;
  isLoading?: boolean;
  onSubmit: (data: {
    content: string;
    recipients: string[];
    includeOriginalContent: boolean;
    originalContent?: string;
  }) => void;
}

export function CommentReplyModal({
  isOpen,
  onClose,
  comment,
  isLoading = false,
  onSubmit,
}: CommentReplyModalProps) {
  const [content, setContent] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [includeOriginal, setIncludeOriginal] = useState(false);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen && comment) {
      // Initialize recipients from original email
      if (comment.replyToAddresses) {
        const addresses = comment.replyToAddresses.split(',').map((a) => a.trim()).filter(Boolean);
        setRecipients(addresses);
      } else {
        setRecipients([]);
      }
      setContent('');
      setIncludeOriginal(false);
      setNewRecipient('');
    }
  }, [isOpen, comment]);

  const handleAddRecipient = () => {
    const email = newRecipient.trim();
    if (email && email.includes('@') && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setNewRecipient('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleSubmit = () => {
    if (content.trim() && recipients.length > 0) {
      onSubmit({
        content,
        recipients,
        includeOriginalContent: includeOriginal,
        originalContent: includeOriginal ? comment?.content : undefined,
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reply to Email"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || recipients.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Reply
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Recipients */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Recipients
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {recipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
              >
                {email}
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(email)}
                  className="hover:text-blue-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Add email address"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRecipient())}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRecipient}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Original message preview */}
        {comment?.originalSubject && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">
              In reply to: <span className="font-medium">{comment.originalSubject}</span>
            </p>
          </div>
        )}

        {/* Your Reply - FIRST */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Your Reply
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your reply..."
            rows={6}
          />
        </div>

        {/* Include original content checkbox - AFTER Your Reply */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeOriginal}
            onChange={(e) => setIncludeOriginal(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Include original message in reply</span>
        </label>

        {/* Original message (shown AFTER Your Reply when checkbox is checked) */}
        {includeOriginal && comment?.content && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-blue-500">
            <p className="text-xs text-muted-foreground mb-1">Original Message:</p>
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}