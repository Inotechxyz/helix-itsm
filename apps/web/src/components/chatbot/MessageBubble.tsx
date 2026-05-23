import ReactMarkdown from 'react-markdown';
import { ChatMessage } from './types';

interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type.includes('pdf')) return '📄';
  if (type.includes('word')) return '📝';
  if (type.includes('excel') || type.includes('sheet')) return '📊';
  if (type.includes('text')) return '📃';
  return '📎';
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Extract attachments from references
  const attachments: Attachment[] = (message.references || [])
    .filter((ref: any) => ref.type === 'attachment')
    .map((ref: any) => ({
      id: ref.id,
      name: ref.name,
      size: ref.size,
      type: ref.mimeType || ref.type,
      url: ref.url,
    }));

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2 max-w-[85%]`}>
        {/* Avatar */}
        {isAssistant && (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Message Content */}
        <div className="space-y-1">
          <div
            className={`px-4 py-2 rounded-2xl ${
              isUser
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-muted rounded-bl-sm'
            } ${isStreaming ? 'animate-pulse' : ''}`}
          >
            {isAssistant ? (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:px-1 prose-code:py-0.5 prose-code:bg-black/10 prose-code:rounded prose-code:text-inherit prose-pre:bg-black/10 prose-pre:p-2 prose-pre:rounded-lg">
                <ReactMarkdown
                  components={{
                    // Open links in current tab instead of new tab
                    a: ({ node, ...props }) => (
                      <a {...props} target="_self" rel="noopener noreferrer" />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-2">
                        <table className="min-w-full text-xs border-collapse" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => (
                      <thead className="bg-black/10" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th className="px-3 py-1 text-left font-medium border border-black/20" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="px-3 py-1 border border-black/20" {...props} />
                    ),
                    tr: ({ node, ...props }) => (
                      <tr className="even:bg-black/5" {...props} />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )}
          </div>

          {/* User Attachments */}
          {isUser && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {attachments.map((attachment, index) => (
                <div
                  key={attachment.id || index}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-xs"
                >
                  <span>{getFileIcon(attachment.type)}</span>
                  <span className="truncate max-w-[120px]">{attachment.name}</span>
                  <span className="text-muted-foreground">({formatFileSize(attachment.size)})</span>
                  {attachment.url && (
                    <a
                      href={attachment.url}
                      target="_self"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline ml-1"
                      title="Download"
                    >
                      ↓
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* References */}
          {message.references && message.references.length > 0 && (
            <div className="space-y-1 mt-2">
              {message.references
                .filter((ref: any) => ref.type !== 'attachment')
                .map((ref: any, index: number) => (
                  <a
                    key={index}
                    href={ref.url}
                    className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs hover:bg-muted transition-colors"
                  >
                    <span className="text-muted-foreground">
                      {ref.type === 'article' && '📄'}
                      {ref.type === 'ticket' && '🎫'}
                      {ref.type === 'service' && '📦'}
                      {ref.type === 'service_request' && '📋'}
                      {!ref.type && '🔗'}
                    </span>
                    <span className="truncate">{ref.title}</span>
                  </a>
                ))}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[10px] text-muted-foreground px-1">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}