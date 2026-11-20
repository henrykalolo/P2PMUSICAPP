'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check, MessageCircle, Search, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';

interface Conversation {
  id: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  otherUser: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}

interface Message {
  id: string;
  body: string;
  createdAt: string;
  senderId: string | null;
  senderUsername: string;
  isMine: boolean;
}

interface SearchUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MessagesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/messages/conversations', { headers: authHeaders() });
      if (!response.ok) throw new Error('Unable to load conversations');
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, markRead = false) => {
    try {
      const response = await fetch(
        `/api/messages/conversations/${conversationId}/messages`,
        { headers: authHeaders() }
      );
      if (!response.ok) throw new Error('Unable to load messages');
      const data = await response.json();
      setMessages(data.messages || []);
      if (markRead) {
        await fetch(`/api/messages/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: authHeaders(),
        });
        setConversations((current) =>
          current.map((item) => (item.id === conversationId ? { ...item, unreadCount: 0 } : item))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load messages');
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setLoading(false);
      return;
    }
    void loadConversations();
  }, [authLoading, isAuthenticated, loadConversations]);

  useEffect(() => {
    if (!isAuthenticated || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=8`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => setSearchResults(data?.users || []))
        .catch(() => undefined);
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [isAuthenticated, searchQuery]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(() => {
      void loadConversations();
      if (selectedId) void loadMessages(selectedId);
    }, 6000);
    return () => clearInterval(timer);
  }, [isAuthenticated, loadConversations, loadMessages, selectedId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConversation = (conversationId: string) => {
    setSelectedId(conversationId);
    setError(null);
    void loadMessages(conversationId, true);
  };

  const startConversation = async (user: SearchUser) => {
    try {
      const response = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ participantId: user.id }),
      });
      if (!response.ok) throw new Error('Unable to start conversation');
      const data = await response.json();
      setSearchQuery('');
      setSearchResults([]);
      await loadConversations();
      selectConversation(data.conversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start conversation');
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !messageText.trim()) return;
    setSending(true);
    try {
      const response = await fetch(`/api/messages/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ body: messageText.trim() }),
      });
      if (!response.ok) throw new Error('Unable to send message');
      const data = await response.json();
      setMessages((current) => [...current, data.message]);
      setMessageText('');
      void loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/60 bg-card p-8 text-center">
          <MessageCircle className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Sign in to message artists</h1>
          <p className="mt-2 text-muted-foreground">
            Direct messages are available to signed-in listeners.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login"><Button variant="outline">Sign in</Button></Link>
            <Link href="/register"><Button>Get started</Button></Link>
          </div>
        </div>
      </main>
    );
  }

  const selected = conversations.find((item) => item.id === selectedId);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <MessageCircle className="h-7 w-7 text-primary" />
            Messages
          </h1>
          <p className="mt-2 text-muted-foreground">One-to-one conversations with other listeners.</p>
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="grid overflow-hidden rounded-2xl border border-border/60 bg-card md:grid-cols-[280px_1fr]">
          <aside className="border-b border-border/60 md:border-b-0 md:border-r">
            <div className="border-b border-border/60 p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Start a conversation"
                  className="pl-9"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-background p-1">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => void startConversation(user)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                    >
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                          <User className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span className="truncate">{user.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[520px] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => selectConversation(conversation.id)}
                    className={`flex w-full items-center gap-3 border-b border-border/40 px-3 py-3 text-left transition-colors ${
                      selectedId === conversation.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                  >
                    {conversation.otherUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={conversation.otherUser.avatarUrl}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {conversation.otherUser.username}
                        </span>
                        {conversation.unreadCount > 0 && (
                          <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {conversation.lastMessage || 'No messages yet'}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex min-h-[400px] flex-col">
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <MessageCircle className="mb-3 h-10 w-10" />
                <p>Select a conversation to start chatting.</p>
              </div>
            ) : (
              <>
                <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                  {selected.otherUser.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.otherUser.avatarUrl}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4" />
                    </span>
                  )}
                  <span className="font-medium">{selected.otherUser.username}</span>
                  <Check className="ml-auto h-4 w-4 text-muted-foreground" />
                </header>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                          message.isMine
                            ? 'rounded-br-sm bg-primary text-primary-foreground'
                            : 'rounded-bl-sm bg-muted text-foreground'
                        }`}
                      >
                        {message.body}
                      </div>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </div>

                <form onSubmit={sendMessage} className="flex gap-2 border-t border-border/60 p-3">
                  <Input
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Write a message"
                    maxLength={2000}
                  />
                  <Button type="submit" disabled={sending || !messageText.trim()}>
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Send</span>
                  </Button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
