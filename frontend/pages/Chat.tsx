import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listMySwings, listMessages, sendMessage } from '../api/webs';
import { getCurrentUserId } from '../lib/auth';
import { useWebSocket } from '../lib/WebSocketContext';
import type { SwingChat, ChatMessage } from '../api/webs';
import { ArrowLeft } from 'lucide-react';

interface ChatProps {
  openChatWebId?: string;
}

const Chat: React.FC<ChatProps> = ({ openChatWebId }) => {
  const { subscribe } = useWebSocket();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chats, setChats] = useState<SwingChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebId, setSelectedWebId] = useState<string | undefined>(openChatWebId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  useEffect(() => {
    if (openChatWebId) setSelectedWebId(openChatWebId);
  }, [openChatWebId]);

  const fetchChats = useCallback(async () => {
    try {
      const swings = await listMySwings();
      setChats(swings);
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    const onVisible = () => fetchChats();
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(fetchChats, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [fetchChats]);

  useEffect(() => {
    if (!openChatWebId) return;
    const refetch = () => listMySwings().then((swings) => setChats(swings)).catch(() => {});
    const t1 = setTimeout(refetch, 400);
    const t2 = setTimeout(refetch, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [openChatWebId]);

  const selectedChat = chats.find((c) => c.webId === selectedWebId);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!selectedWebId) return;
    if (!silent) setMessagesLoading(true);
    try {
      const msgs = await listMessages(selectedWebId);
      setMessages(msgs);
    } catch {
      if (!silent) setMessages([]);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, [selectedWebId]);

  useEffect(() => {
    if (selectedWebId) fetchMessages(false);
  }, [selectedWebId, fetchMessages]);

  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputValue.trim();
    if (!content || !selectedWebId || sending) return;
    setSending(true);
    setInputValue('');
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      userId: currentUserId || '',
      userName: 'You',
      content,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await sendMessage(selectedWebId, content);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert(err instanceof Error ? err.message : 'Failed to send');
      setInputValue(content);
    } finally {
      setSending(false);
    }
  };

  // Poll for new messages when thread is open (fallback if WebSocket unavailable)
  useEffect(() => {
    if (!selectedWebId) return;
    const interval = setInterval(() => fetchMessages(true), 15000);
    return () => clearInterval(interval);
  }, [selectedWebId, fetchMessages]);

  // Real-time: append new messages from WebSocket when viewing this chat
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type !== 'message_new' || ev.webId !== selectedWebId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === ev.message.id)) return prev;
        return [...prev, ev.message];
      });
    });
  }, [subscribe, selectedWebId]);

  // Thread view (messages + input)
  if (selectedWebId && selectedChat) {
    return (
      <div className="flex flex-col h-screen overflow-hidden pb-24">
        <div className="flex items-center gap-2 p-4 border-b border-noir-steel bg-noir-charcoal shrink-0">
          <button
            type="button"
            onClick={() => setSelectedWebId(undefined)}
            className="p-1.5 rounded-lg hover:bg-noir-graphite text-noir-light"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
          <img
            src={`https://picsum.photos/seed/${selectedChat.webOwnerId}/40/40`}
            className="w-10 h-10 rounded-lg border border-noir-steel flex-shrink-0"
            alt={selectedChat.userName}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-noir-light font-semibold truncate">{selectedChat.userName}</h2>
            <p className="text-xs text-noir-smoke font-mono truncate">{selectedChat.userHandle}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messagesLoading ? (
            <p className="text-noir-ash font-mono text-sm animate-pulse">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-noir-ash font-mono text-sm italic">No messages yet. Say something!</p>
          ) : (
            messages.map((msg) => {
              const isMe = currentUserId != null && msg.userId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                      isMe
                        ? 'bg-web-crimson/80 text-noir-light rounded-br-md'
                        : 'bg-noir-graphite border border-noir-steel text-noir-fog rounded-bl-md'
                    }`}
                  >
                    {!isMe && (
                      <p className="text-xs text-web-amber font-mono mb-0.5">{msg.userName}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="p-4 border-t border-noir-steel bg-noir-charcoal shrink-0"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-noir-graphite border border-noir-steel rounded-xl py-3 px-4 text-sm text-noir-light placeholder:text-noir-ash focus:outline-none focus:border-web-crimson"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || sending}
              className="px-5 py-3 bg-web-crimson text-noir-light rounded-xl font-mono text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-web-red transition-colors"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // List view
  return (
    <div className="flex flex-col pt-8 pb-32 px-4 h-screen overflow-hidden">
      <h1 className="font-display font-black text-2xl text-noir-light uppercase tracking-widest mb-2">
        Whispers in the dark
      </h1>
      <p className="text-noir-smoke font-mono text-xs uppercase tracking-tighter mb-6">
        Chats from webs you swung into — tap to open
      </p>

      {loading ? (
        <p className="text-noir-ash font-mono text-sm animate-pulse">Loading...</p>
      ) : chats.length === 0 ? (
        <p className="text-noir-ash font-mono text-sm italic">
          No chats yet. Swing into someone&apos;s post to start a conversation.
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {chats.map((chat) => (
            <button
              key={chat.webId}
              ref={selectedWebId === chat.webId ? selectedRef : undefined}
              type="button"
              onClick={() => setSelectedWebId(chat.webId)}
              className="w-full text-left p-4 rounded-xl border border-noir-steel bg-noir-charcoal hover:border-noir-ash transition-colors"
            >
              <div className="flex gap-3">
                <img
                  src={`https://picsum.photos/seed/${chat.webOwnerId}/48/48`}
                  className="w-12 h-12 rounded-lg border border-noir-steel flex-shrink-0"
                  alt={chat.userName}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-noir-light font-semibold truncate">{chat.userName}</h3>
                  <p className="text-xs text-noir-smoke font-mono truncate">{chat.userHandle}</p>
                  <p className="text-noir-fog text-sm italic truncate mt-0.5">&quot;{chat.content}&quot;</p>
                  <p className="text-noir-ash text-xs font-mono mt-1">{chat.timestamp}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Chat;
