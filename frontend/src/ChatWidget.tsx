import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ChatWidget.module.css';
import API_BASE_URL from './config/api';

interface Message {
  id: number;
  message_type: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: number;
  title: string;
}

interface ChatWidgetProps {
  user?: {
    id: string;
    user_name: string;
    profile_picture?: string;
  } | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface RateLimitInfo {
  remaining: number;
  total: number;
  resetTime: string;
}

// Render markdown-like formatting (bold, bullet points, line breaks)
const FormattedMessage: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');

  return (
    <div>
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        );

        // Bullet point
        if (line.startsWith('• ') || line.startsWith('- ')) {
          const bulletContent = line.substring(2); // Remove bullet and space
          const bulletParts = bulletContent.split(/\*\*(.*?)\*\*/g);
          const bulletRendered = bulletParts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          );
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', marginTop: i === 0 ? 0 : '4px' }}>
              <span style={{ flexShrink: 0, marginTop: '1px' }}>•</span>
              <span>{bulletRendered}</span>
            </div>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          const numberMatch = line.match(/^(\d+\.\s)(.*)/);
          if (numberMatch) {
            const [, numberPart, restOfLine] = numberMatch;
            const restParts = restOfLine.split(/\*\*(.*?)\*\*/g);
            const restRendered = restParts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
            );
            return (
              <div key={i} style={{ display: 'flex', gap: '6px', marginTop: i === 0 ? 0 : '4px' }}>
                <span style={{ flexShrink: 0 }}>{numberPart}</span>
                <span>{restRendered}</span>
              </div>
            );
          }
        }

        // Empty line = spacing
        if (line.trim() === '') {
          return <div key={i} style={{ height: '6px' }} />;
        }

        return <div key={i} style={{ marginTop: i === 0 ? 0 : '4px' }}>{rendered}</div>;
      })}
    </div>
  );
};

const QUICK_ACTIONS = [
  "How do I create a booking service?",
  "How can clients book sessions with me?",
  "How do I connect Google Calendar?",
  "How do I set up online payments?",
  "How do I write session notes?",
];

const ChatWidget: React.FC<ChatWidgetProps> = ({ user, mobileOpen = false, onMobileClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const loadConversation = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/conversation`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setConversation(data.conversation);
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !hasLoaded) {
      // Only auto-load if we have no conversation yet (not after a clear)
      if (!conversation) {
        loadConversation();
      } else {
        setHasLoaded(true);
      }
    }
  }, [isOpen, hasLoaded, conversation, loadConversation]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen || mobileOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, mobileOpen]);

  // Load conversation when mobile chat opens
  useEffect(() => {
    if (mobileOpen && !hasLoaded && !conversation) {
      loadConversation();
    }
  }, [mobileOpen, hasLoaded, conversation, loadConversation]);

  const sendMessage = async (messageText?: string) => {
    const text = (messageText || inputValue).trim();
    if (!text || isLoading || rateLimitInfo?.remaining === 0) return;

    setInputValue('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setIsLoading(true);
    setIsTyping(true);

    // Optimistically add user message
    const tempId = Date.now();
    const userMessage: Message = {
      id: tempId,
      message_type: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          conversationId: conversation?.id,
          context: { currentPage: window.location.pathname },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (!conversation) setConversation(data.conversation);
        setMessages(prev => [...prev, data.message]);
        
        // Update rate limit info from response headers
        const remaining = response.headers.get('RateLimit-Remaining');
        const limit = response.headers.get('RateLimit-Limit');
        const reset = response.headers.get('RateLimit-Reset');
        
        if (remaining && limit && reset) {
          setRateLimitInfo({
            remaining: parseInt(remaining),
            total: parseInt(limit),
            resetTime: new Date(Date.now() + parseInt(reset) * 1000).toISOString()
          });
        }
      } else if (response.status === 429) {
        // Rate limit exceeded
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Too many messages. Please wait a few minutes.';
        setMessages(prev => [
          ...prev,
          {
            id: Date.now(),
            message_type: 'assistant',
            content: `⏱️ ${message}`,
            created_at: new Date().toISOString(),
          },
        ]);
        
        // Update rate limit info from error response
        if (errorData.resetTime) {
          setRateLimitInfo({
            remaining: 0,
            total: 30,
            resetTime: errorData.resetTime
          });
        }
      } else {
        throw new Error('Request failed');
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          message_type: 'assistant',
          content: 'Sorry, I ran into an issue. Please try again.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 80) + 'px';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleNewChat = async () => {
    // Delete the current conversation from the backend
    if (conversation?.id) {
      try {
        await fetch(`${API_BASE_URL}/api/chat/conversation/${conversation.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    }
    // Reset all state — next message will create a fresh conversation
    setMessages([]);
    setConversation(null);
    setHasLoaded(false);
  };

  if (!user) return null;

  const initials = user.user_name.charAt(0).toUpperCase();
  const profilePicUrl = user.profile_picture
    ? (user.profile_picture.startsWith('http')
        ? user.profile_picture
        : `${API_BASE_URL}${user.profile_picture}`)
    : null;

  // Shared chat panel content (used in both desktop and mobile)
  const chatPanelContent = (isMobile: boolean) => (
    <>
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderLeft}>
          <div className={styles.chatAvatar}>
            <img src="/MelloFevicon 1.png" alt="Mello" className={styles.avatarImg} />
          </div>
          <div className={styles.chatHeaderInfo}>
            <h3>Mello</h3>
            <p>Platform assistant · Always here</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {messages.length > 0 && (
            <button
              className={styles.chatCloseBtn}
              onClick={handleNewChat}
              title="Clear chat"
              aria-label="Clear chat"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
          <button
            className={styles.chatCloseBtn}
            onClick={isMobile ? onMobileClose : () => setIsOpen(false)}
            aria-label="Close chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.chatMessages}>
        {messages.length === 0 ? (
          <div className={styles.welcomeMessage}>
            <div className={styles.welcomeEmoji}>👋</div>
            <h4>Hi {user.user_name.split(' ')[0]}</h4>
            <p>I'm Mello. Ask me anything about the platform or pick a question below.</p>
            <div className={styles.securityNotice}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <circle cx="12" cy="16" r="1" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Your messages are encrypted and secure</span>
            </div>
            <div className={styles.quickActions}>
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  className={styles.quickActionBtn}
                  onClick={() => sendMessage(action)}
                  disabled={isLoading}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`${styles.message} ${styles[msg.message_type]}`}>
              <div className={styles.messageAvatar}>
                {msg.message_type === 'user'
                  ? profilePicUrl
                    ? <img src={profilePicUrl} alt={user.user_name} className={styles.avatarImg} />
                    : initials
                  : <img src="/MelloFevicon 1.png" alt="Mello" className={styles.avatarImg} />
                }
              </div>
              <div className={styles.messageBubbleGroup}>
                <div className={styles.messageContent}>
                  {msg.message_type === 'assistant'
                    ? <FormattedMessage content={msg.content} />
                    : msg.content
                  }
                </div>
                <div className={styles.messageTime}>{formatTime(msg.created_at)}</div>
              </div>
            </div>
          ))
        )}

        {isTyping && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.messageAvatar}>
              <img src="/MelloFevicon 1.png" alt="Mello" className={styles.avatarImg} />
            </div>
            <div className={styles.typingIndicator}>
              <div className={styles.typingDots}>
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.chatInput}>
        <div className={styles.inputContainer}>
          <textarea
            ref={inputRef}
            className={styles.messageInput}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything…"
            disabled={isLoading}
            rows={1}
            aria-label="Chat message input"
          />
          <button
            className={styles.sendBtn}
            onClick={() => sendMessage()}
            disabled={isLoading || !inputValue.trim() || (rateLimitInfo?.remaining === 0)}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22,2 15,22 11,13 2,9 22,2" />
            </svg>
          </button>
        </div>
        <div className={styles.inputHint}>
          {rateLimitInfo && rateLimitInfo.remaining <= 5 && rateLimitInfo.remaining > 0 ? (
            <span style={{ color: '#f59e0b' }}>
              ⚠️ {rateLimitInfo.remaining} messages left in this 15-min window
            </span>
          ) : rateLimitInfo && rateLimitInfo.remaining === 0 ? (
            <span style={{ color: '#ef4444' }}>
              🚫 Rate limit reached. Try again in a few minutes.
            </span>
          ) : (
            'Press Enter to send · Shift+Enter for new line'
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile full-screen chat */}
      {mobileOpen && (
        <div className={styles.mobileChatOverlay} role="dialog" aria-label="AI Assistant">
          {chatPanelContent(true)}
        </div>
      )}

      {/* Desktop floating widget — hidden on mobile */}
      <div className={styles.chatWidget}>
        <button
          className={`${styles.chatToggle} ${isOpen ? styles.open : ''}`}
          onClick={() => setIsOpen(prev => !prev)}
          aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        >
          {isOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#D5FFFA' }}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <>
              <img src="/MelloFevicon 1.png" alt="Mello" className={styles.toggleFavicon} />
              <div className={styles.chatBadge}>AI</div>
            </>
          )}
        </button>

        <div className={`${styles.chatContainer} ${isOpen ? styles.open : ''}`} role="dialog" aria-label="AI Assistant">
          {chatPanelContent(false)}
        </div>
      </div>
    </>
  );
};

export default ChatWidget;
