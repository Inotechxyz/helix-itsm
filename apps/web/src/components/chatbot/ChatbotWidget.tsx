import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatbotApi } from '../../api/client';
import { useCurrentOrganizationId } from '../../stores/organizationStore';
import { showToast } from '../ui/Toast';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { ChatHeader } from './ChatHeader';
import { QuickReplies } from './QuickReplies';
import { organizationsApi } from '../../api/client';

const SESSION_KEY = 'helix_chatbot_session';
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE_CLOSE_MS = 60000; // 1 minute warning

interface ChatMessage {
  id: string;
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType: 'text' | 'rich' | 'quick_reply' | 'card';
  intent?: string;
  references?: any[];
  createdAt: Date;
}

interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface StoredSession {
  sessionId: string;
  messages: ChatMessage[];
  messageCount: number;
  status?: string;
}

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [session, setSession] = useState<{ sessionId: string; messages: ChatMessage[]; messageCount: number; status?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const organizationId = useCurrentOrganizationId();
  const queryClient = useQueryClient();

  // Toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Reset idle timer
  const resetIdleTimer = () => {
    lastActivityRef.current = Date.now();
    setIdleWarning(false);

    // Clear existing timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    // Set warning timer (10 mins - 1 min warning)
    warningTimerRef.current = setTimeout(() => {
      setIdleWarning(true);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_CLOSE_MS);

    // Set close timer
    idleTimerRef.current = setTimeout(async () => {
      if (session) {
        console.log('[ChatbotWidget] Idle timeout - closing session');
        // Send goodbye message
        try {
          await chatbotApi.sendMessage(session.sessionId, {
            content: 'Session timed out due to inactivity. Your session has ended. Feel free to start a new conversation anytime!'
          });
        } catch (e) {
          // Ignore errors
        }

        // Close session
        await chatbotApi.closeSession(session.sessionId).catch(() => {});

        // Clear local state
        setSession(null);
        setIsOpen(false);
        if (organizationId) {
          localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
        }
      }
    }, IDLE_TIMEOUT_MS);
  };

  // Start idle timer when session exists
  useEffect(() => {
    if (session && isOpen) {
      resetIdleTimer();
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [session, isOpen, organizationId]);

  // Track user activity (mouse, keyboard, scroll)
  useEffect(() => {
    if (!session || !isOpen) return;

    const activityHandler = () => {
      if (!idleWarning) {
        resetIdleTimer();
      }
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, activityHandler, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, activityHandler);
      });
    };
  }, [session, isOpen, idleWarning]);

  // Check AI enabled status from license
  const { data: licenseStatus } = useQuery({
    queryKey: ['organizations', organizationId, 'license'],
    queryFn: async () => {
      if (!organizationId) return { aiEnabled: false };
      const response = await organizationsApi.getLicenseStatus(organizationId);
      return response.data;
    },
    enabled: !!organizationId,
  });

  const aiEnabled = licenseStatus?.aiEnabled || false;

  // Load session from localStorage on mount
  useEffect(() => {
    console.log('[ChatbotWidget] useEffect triggered: aiEnabled=', aiEnabled, 'organizationId=', organizationId);
    if (aiEnabled && organizationId) {
      const stored = localStorage.getItem(`${SESSION_KEY}_${organizationId}`);
      console.log('[ChatbotWidget] Checking localStorage for stored session:', stored ? 'found' : 'none');

      if (stored) {
        try {
          const parsed: StoredSession = JSON.parse(stored);
          console.log('[ChatbotWidget] Found stored session:', parsed.sessionId);
          // Verify session still exists on backend
          chatbotApi.getSession(parsed.sessionId)
            .then((response) => {
              const existingSession = response.data;
              // Check if session is still active
              if (existingSession.status === 'active') {
                // Fetch messages for this session
                chatbotApi.getSessionWithMessages(parsed.sessionId)
                  .then((msgResponse) => {
                    setSession({
                      sessionId: parsed.sessionId,
                      messages: msgResponse.data.messages || [],
                      messageCount: msgResponse.data.messageCount || parsed.messages.length,
                      status: msgResponse.data.status || existingSession.status,
                    });
                  })
                  .catch((err) => {
                    console.warn('Failed to load session messages, creating new session:', err);
                    // Session exists but failed to load messages, clear and create new
                    localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
                    createSession();
                  });
              } else {
                // Session closed/expired, clear storage and create new
                localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
                createSession();
              }
            })
            .catch((err) => {
              console.warn('Session not found, creating new session:', err);
              // Session no longer valid, clear storage and create new
              localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
              createSession();
            });
        } catch {
          localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
          createSession();
        }
      } else {
        console.log('[ChatbotWidget] No stored session found, will wait for widget to open');
      }
    }
  }, [aiEnabled, organizationId]);

  // Save session to localStorage when it changes
  useEffect(() => {
    if (session && organizationId) {
      const stored: StoredSession = {
        sessionId: session.sessionId,
        messages: session.messages,
        messageCount: session.messageCount,
        status: session.status,
      };
      localStorage.setItem(`${SESSION_KEY}_${organizationId}`, JSON.stringify(stored));
    }
  }, [session, organizationId]);

  // Initialize session when widget opens (only if no session exists)
  useEffect(() => {
    if (isOpen && !session && aiEnabled && organizationId) {
      createSession();
    }
  }, [isOpen, session, aiEnabled, organizationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  // Scroll to bottom when widget opens with messages
  useEffect(() => {
    if (isOpen && session?.messages?.length) {
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [isOpen]);

  // Start a new conversation
  const startNewConversation = async () => {
    // Close current session if exists
    if (session) {
      try {
        await chatbotApi.closeSession(session.sessionId);
      } catch (error: any) {
        console.warn('Failed to close old session:', error.message);
      }
    }

    // Clear local session and create new one
    setSession(null);
    if (organizationId) {
      localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
    }

    // Create new session
    createSession();
  };

  const createSession = async () => {
    console.log('[ChatbotWidget] Creating new session...');
    console.log('[ChatbotWidget] Current state: organizationId=', organizationId);
    setIsLoading(true);
    try {
      console.log('[ChatbotWidget] Calling chatbotApi.createSession()...');
      const response = await chatbotApi.createSession();
      console.log('[ChatbotWidget] Session created response:', response);
      console.log('[ChatbotWidget] Session created response.data:', response.data);
      console.log('[ChatbotWidget] Session ID from response:', response.data?.sessionId);
      console.log('[ChatbotWidget] Session ID from response (id field):', response.data?.id);

      // Check response structure - both sessionId and id fields
      const sessionId = response.data?.sessionId || response.data?.id;
      if (!sessionId) {
        console.error('[ChatbotWidget] ERROR: No sessionId or id in response!');
        console.error('[ChatbotWidget] Full response keys:', Object.keys(response.data || {}));
        throw new Error('Invalid session response - no session ID');
      }

      // Extract messages from the response
      const sessionData = response.data;
      setSession({
        sessionId: sessionId,
        messages: sessionData.messages || [],
        messageCount: sessionData.messageCount || 0,
        status: sessionData.status || 'active',
      });
      console.log('[ChatbotWidget] Session state set with sessionId:', sessionId);
    } catch (error: any) {
      console.error('[ChatbotWidget] Failed to create session:', error);
      console.error('[ChatbotWidget] Error response:', error.response);
      console.error('[ChatbotWidget] Error message:', error.message);
      console.error('[ChatbotWidget] Error status:', error.response?.status);
      showToast(error.message || 'Failed to start chat', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Send message with attachments
  const sendMessage = async (content: string, attachments?: AttachmentFile[]) => {
    if (!session) {
      // No session, create one and then send
      try {
        const response = await chatbotApi.createSession();
        const newSessionData = response.data;
        // Check response structure - both sessionId and id fields
        const sessionId = newSessionData?.sessionId || newSessionData?.id;
        if (!sessionId) {
          console.error('[ChatbotWidget] Invalid session response in sendMessage');
          showToast('Failed to start chat session', 'error');
          return;
        }
        setSession({
          sessionId: sessionId,
          messages: newSessionData.messages || [],
          messageCount: newSessionData.messageCount || 0,
          status: newSessionData.status || 'active',
        });
        // Now send the message with the new session
        await sendMessageWithSession(sessionId, content);
        // Update session status after message is sent
        setSession(prev => prev ? { ...prev, status: prev.status } : null);
      } catch (error: any) {
        console.error('[ChatbotWidget] Failed to create session in sendMessage:', error);
        showToast(error.message || 'Failed to start chat session', 'error');
      }
      return;
    }

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      messageId: `temp-${Date.now()}`,
      role: 'user',
      content,
      contentType: attachments && attachments.length > 0 ? 'rich' : 'text',
      createdAt: new Date(),
    };

    setSession((prev) => prev ? ({
      ...prev,
      messages: [...prev.messages, userMessage],
      messageCount: prev.messageCount + 1,
    }) : null);

    // Show typing indicator
    setIsTyping(true);

    try {
      // Send message with attachments metadata
      const response = await chatbotApi.sendMessage(session.sessionId, {
        content,
        attachments: attachments?.map(a => ({
          id: a.id,
          name: a.name,
          size: a.size,
          type: a.type,
        })),
      });
      const data = response.data;

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: data.messageId,
        messageId: data.messageId,
        role: 'assistant',
        content: data.content,
        contentType: data.contentType || 'text',
        intent: data.intent,
        references: data.references,
        createdAt: new Date(),
      };

      // Update session state with new message and refresh status
      setSession(prev => prev ? ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        messageCount: prev.messageCount + 1,
        status: data.sessionStatus || prev.status,
      }) : null);

      // Refresh session to get updated state
      queryClient.invalidateQueries({ queryKey: ['chatbot-session'] });
    } catch (error: any) {
      console.error('Failed to send message:', error);
      // Check if session not found error
      if (error.response?.status === 404) {
        showToast('Session expired. Please try again.', 'error');
        // Clear session and let it auto-recreate
        setSession(null);
        localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
      } else {
        showToast(error.message || 'Failed to send message', 'error');
      }
    } finally {
      setIsTyping(false);
    }
  };

  // Helper function to send message with specific session
  const sendMessageWithSession = async (sessionId: string, content: string) => {
    setIsTyping(true);
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      messageId: `temp-${Date.now()}`,
      role: 'user',
      content,
      contentType: 'text',
      createdAt: new Date(),
    };

    setSession((prev) => prev ? ({
      ...prev,
      messages: [...prev.messages, userMessage],
      messageCount: prev.messageCount + 1,
    }) : null);

    try {
      const response = await chatbotApi.sendMessage(sessionId, { content });
      const data = response.data;

      const assistantMessage: ChatMessage = {
        id: data.messageId,
        messageId: data.messageId,
        role: 'assistant',
        content: data.content,
        contentType: data.contentType || 'text',
        intent: data.intent,
        references: data.references,
        createdAt: new Date(),
      };

      setSession(prev => prev ? ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        messageCount: prev.messageCount + 1,
        status: data.sessionStatus || prev.status,
      }) : null);
    } catch (error: any) {
      showToast(error.message || 'Failed to send message', 'error');
    } finally {
      setIsTyping(false);
    }
  };

  // Clear session on logout
  const clearSession = () => {
    if (session && organizationId) {
      localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
    }
    setSession(null);
  };

  // Expose clearSession for external use (e.g., on logout)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__clearChatbotSession = clearSession;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__clearChatbotSession;
      }
    };
  }, [session, organizationId]);

  // Hide chat window without closing the session (keeps session for resuming)
  const hideChat = () => {
    // Just close the UI - session remains in localStorage for next time
    // Clear idle timers when hiding
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setIdleWarning(false);
    setIsOpen(false);
  };

  // Actually close and end the session (for logout or explicit close)
  const closeSession = async () => {
    // Clear idle timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setIdleWarning(false);

    if (!session) {
      setIsOpen(false);
      return;
    }

    try {
      await chatbotApi.closeSession(session.sessionId);
    } catch (error: any) {
      console.warn('Failed to close session on server:', error.message);
    }

    // Clear session state and localStorage
    setSession(null);
    setIsOpen(false);
    if (organizationId) {
      localStorage.removeItem(`${SESSION_KEY}_${organizationId}`);
    }
  };

  if (!aiEnabled) {
    return null; // Don't render widget if AI is not enabled
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        aria-label="Open chat"
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed bottom-24 right-6 z-50 bg-background border rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isExpanded
            ? 'w-[800px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-150px)]'
            : 'w-96 max-w-[calc(100vw-48px)] h-[500px] max-h-[calc(100vh-200px)]'
        }`}>
          <ChatHeader
            onClose={hideChat}
            onNewConversation={startNewConversation}
            session={session}
            showIdleWarning={idleWarning}
            isExpanded={isExpanded}
            onToggleExpand={toggleExpanded}
          />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : session?.messages?.length === 0 && !isTyping ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm">Start a conversation with our AI assistant</p>
              </div>
            ) : (
              <>
                {session?.messages?.map((message) => (
                  <MessageBubble key={message.messageId} message={message} />
                ))}
                {/* Typing indicator */}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Quick Replies */}
          <QuickReplies onSelect={sendMessage} messageCount={session?.messageCount || 0} disabled={isTyping} />

          {/* Input */}
          <MessageInput onSend={sendMessage} isLoading={isTyping} />
        </div>
      )}
    </>
  );
}