import { useState, useRef } from 'react';
import { chatbotApi } from '../../api/client';

interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface MessageInputProps {
  onSend: (message: string, attachments?: AttachmentFile[]) => void;
  isLoading?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/markdown',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function MessageInput({ onSend, isLoading }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || attachments.length > 0) && !isLoading && !uploading) {
      // Upload any pending attachments first
      if (attachments.some(a => !a.id.startsWith('uploaded-'))) {
        setUploading(true);
        try {
          const uploadedAttachments: AttachmentFile[] = [];

          for (const attachment of attachments) {
            if (attachment.id.startsWith('uploaded-')) {
              uploadedAttachments.push(attachment);
            } else {
              // Get the actual file from the input
              const fileInput = fileInputRef.current;
              if (fileInput?.files) {
                const file = Array.from(fileInput.files).find(f => f.name === attachment.name);
                if (file) {
                  const uploaded = await chatbotApi.uploadFile(file);
                  uploadedAttachments.push({
                    id: `uploaded-${uploaded.id}`,
                    name: uploaded.name,
                    size: uploaded.size,
                    type: uploaded.type,
                    url: uploaded.url,
                  });
                }
              }
            }
          }

          setUploading(false);
          onSend(message.trim(), uploadedAttachments);
          setMessage('');
          setAttachments([]);
        } catch (error) {
          setUploading(false);
          alert('Failed to upload attachments. Please try again.');
        }
      } else {
        onSend(message.trim(), attachments);
        setMessage('');
        setAttachments([]);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: AttachmentFile[] = [];
    for (const file of files) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`File type "${file.type}" is not supported`);
        continue;
      }
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" exceeds 10MB limit`);
        continue;
      }
      // Validate max attachments (5)
      if (attachments.length + newFiles.length >= 5) {
        alert('Maximum 5 attachments allowed');
        break;
      }

      const fileData: AttachmentFile = {
        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
      };
      newFiles.push(fileData);
    }

    if (newFiles.length > 0) {
      setAttachments([...attachments, ...newFiles]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm"
            >
              <span className="text-xs text-muted-foreground">
                {attachment.type.startsWith('image/') ? '🖼️' :
                  attachment.type.includes('pdf') ? '📄' :
                    attachment.type.includes('word') ? '📝' :
                      attachment.type.includes('excel') || attachment.type.includes('sheet') ? '📊' :
                        '📎'}
              </span>
              <span className="max-w-[120px] truncate">{attachment.name}</span>
              <span className="text-xs text-muted-foreground">
                ({formatFileSize(attachment.size)})
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || uploading || attachments.length >= 5}
          className="w-10 h-10 border rounded-lg flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Attach files"
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground border-t-transparent" />
          ) : (
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            style={{
              minHeight: '42px',
              maxHeight: '120px',
            }}
            disabled={isLoading || uploading}
          />
        </div>

        <button
          type="submit"
          disabled={(!message.trim() && attachments.length === 0) || isLoading || uploading}
          className="w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading || uploading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 flex justify-between">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>Supports: Images, PDF, DOC, XLS, TXT, MD (max 10MB)</span>
      </p>
    </form>
  );
}