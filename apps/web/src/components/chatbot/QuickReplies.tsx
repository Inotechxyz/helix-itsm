interface QuickRepliesProps {
  onSelect: (message: string) => void;
  messageCount?: number;
  disabled?: boolean;
}

const DEFAULT_QUICK_REPLIES = [
  { label: 'Create a ticket', value: 'I want to create a support ticket' },
  { label: 'Search KB', value: 'How do I reset my password?' },
  { label: 'Check my tickets', value: 'Show my recent tickets' },
  { label: 'Browse services', value: 'What services are available?' },
];

export function QuickReplies({ onSelect, messageCount = 0, disabled = false }: QuickRepliesProps) {
  // Show quick replies only for new sessions (after greeting but before user sends messages)
  if (messageCount > 1) return null;

  return (
    <div className="px-4 py-2 border-t bg-muted/30">
      <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_QUICK_REPLIES.map((reply) => (
          <button
            key={reply.label}
            onClick={() => !disabled && onSelect(reply.value)}
            disabled={disabled}
            className={`px-3 py-1.5 text-xs bg-background border rounded-full transition-colors ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-muted cursor-pointer'
            }`}
          >
            {reply.label}
          </button>
        ))}
      </div>
    </div>
  );
}