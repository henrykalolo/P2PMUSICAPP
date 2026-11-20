'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UnifiedMusicPlayer } from '@/components/player/UnifiedMusicPlayer';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import {
  Check,
  Clock,
  Heart,
  MessageCircle,
  Repeat,
  Send,
  Share2,
  Trash2,
  User,
  X,
} from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  timestampSeconds: number | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

interface FeedItemProps {
  post: {
    id: string;
    title: string;
    artist: string;
    album: string;
    genre: string;
    duration: number;
    ipfsCid?: string;
    streamUrl?: string | null;
    storageType?: string;
    serverStorageId?: string;
    coverArtUrl?: string;
    createdAt: string;
    author: {
      id: string;
      username: string;
      avatarUrl?: string;
    };
    likesCount: number;
    commentsCount: number;
    userHasLiked?: boolean;
  };
  currentUserId?: string;
}

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2600);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg md:bottom-6"
    >
      <Check className="h-3.5 w-3.5 text-primary" />
      <span className="max-w-[70vw] truncate">{message}</span>
    </div>
  );
};

interface ActionButtonProps {
  label: string;
  count?: number;
  active?: boolean;
  activeClassName?: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  count,
  active,
  activeClassName,
  onClick,
  disabled,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={count === undefined ? label : `${label}: ${count}`}
    aria-pressed={active}
    title={label}
    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 ${
      active ? activeClassName : ''
    }`}
  >
    {children}
    {count !== undefined && <span className="tabular-nums">{count}</span>}
  </button>
);

const CommentItem: React.FC<{
  comment: Comment;
  currentUserId?: string;
  onDelete: (commentId: string) => void;
}> = ({ comment, currentUserId, onDelete }) => {
  const isOwner = currentUserId === comment.user.id;
  const hasTimestamp = comment.timestampSeconds !== null && comment.timestampSeconds >= 0;

  return (
    <div className="group flex gap-2 rounded-md px-1 py-2 hover:bg-muted/40">
      {comment.user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comment.user.avatarUrl}
          alt={comment.user.username}
          className="h-7 w-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <Link
            href={`/user/${comment.user.id}`}
            className="truncate text-xs font-medium hover:text-primary"
          >
            {comment.user.username}
          </Link>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {hasTimestamp && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              <Clock className="h-2.5 w-2.5" />
              {formatTimestamp(comment.timestampSeconds!)}
            </span>
          )}
        </div>
        <p className="break-words text-sm">{comment.content}</p>
      </div>

      {isOwner && (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          aria-label="Delete comment"
          title="Delete comment"
          className="h-7 w-7 shrink-0 rounded-md text-muted-foreground opacity-60 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="mx-auto h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export const EnhancedFeedItem: React.FC<FeedItemProps> = ({ post, currentUserId }) => {
  const { user } = useAuthStore();
  const viewerId = currentUserId ?? user?.id;

  const [hasLiked, setHasLiked] = useState(post.userHasLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(0);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostCaption, setRepostCaption] = useState('');

  const notify = useCallback((message: string) => setToast(message), []);

  const fetchComments = useCallback(async () => {
    if (!showComments) return;

    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/social/comments?postId=${post.id}`);
      if (!response.ok) throw new Error('Failed to load comments');
      const data = await response.json();
      setComments(data.comments || []);
      setCommentsCount(data.count ?? data.comments?.length ?? 0);
    } catch {
      notify('Failed to load comments');
    } finally {
      setIsLoadingComments(false);
    }
  }, [notify, post.id, showComments]);

  const fetchRepostCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const options: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await fetch(`/api/social/repost?postId=${post.id}`, options);
      if (response.ok) {
        const data = await response.json();
        setRepostsCount(data.repostsCount ?? 0);
        setHasReposted(Boolean(data.userHasReposted));
      }
    } catch {
      // Repost counts are non-critical; the rest of the card still works.
    }
  }, [post.id]);

  useEffect(() => {
    void fetchComments();
    void fetchRepostCount();
  }, [fetchComments, fetchRepostCount]);

  const handleRepost = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      notify('Sign in to repost');
      return;
    }

    try {
      const response = await fetch('/api/social/repost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          caption: repostCaption.trim() || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to repost');

      const data = await response.json();
      setRepostsCount(data.repostsCount ?? repostsCount + 1);
      setHasReposted(true);
      setShowRepostModal(false);
      setRepostCaption('');
      notify('Reposted');
    } catch {
      notify('Failed to repost');
    }
  };

  const handleRemoveRepost = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`/api/social/repost?postId=${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to remove repost');

      const data = await response.json();
      setRepostsCount(data.repostsCount ?? Math.max(0, repostsCount - 1));
      setHasReposted(false);
      setShowRepostModal(false);
      notify('Repost removed');
    } catch {
      notify('Failed to remove repost');
    }
  };

  const handleLike = async () => {
    if (isLiking) return;

    const token = localStorage.getItem('token');
    if (!token) {
      notify('Sign in to like tracks');
      return;
    }

    setIsLiking(true);
    try {
      if (hasLiked) {
        const response = await fetch(`/api/social/like?postId=${post.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to unlike');
        setHasLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      } else {
        const response = await fetch('/api/social/like', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ postId: post.id }),
        });
        if (!response.ok) throw new Error('Failed to like');

        const data = await response.json();
        setHasLiked(true);
        setLikesCount(data.likesCount ?? likesCount + 1);
        if (data.awardedBadge && data.badgeMessage) {
          notify(`${data.awardedBadge}: ${data.badgeMessage}`);
        }
      }
    } catch {
      notify('Failed to update like');
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    const token = localStorage.getItem('token');
    if (!token) {
      notify('Sign in to comment');
      return;
    }

    setIsSubmittingComment(true);
    try {
      const response = await fetch('/api/social/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          content: commentText.trim(),
          timestampSeconds: commentTimestamp,
        }),
      });
      if (!response.ok) throw new Error('Failed to post comment');

      const data = await response.json();
      setComments((prev) => [data.comment, ...prev]);
      setCommentsCount(data.commentsCount ?? commentsCount + 1);
      setCommentText('');
      setCommentTimestamp(null);
      notify('Comment added');
    } catch {
      notify('Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`/api/social/comments?id=${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete comment');

      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      setCommentsCount((prev) => Math.max(0, prev - 1));
      notify('Comment removed');
    } catch {
      notify('Failed to delete comment');
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: post.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      notify('Link copied');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      notify('Could not share link');
    }
  };

  const setTimestampFromPlayback = () => {
    const { currentTrack, progress: playerProgress } = usePlayerStore.getState();
    if (currentTrack?.id === post.id && post.duration > 0) {
      setCommentTimestamp(Math.floor((playerProgress / 100) * post.duration));
    }
  };

  const metadata = [post.artist, post.album, post.genre].filter(Boolean).join(' · ');

  return (
    <article className="rounded-xl border border-border/60 bg-card p-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {showRepostModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={hasReposted ? 'Remove repost' : 'Repost track'}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {hasReposted ? 'Remove repost?' : 'Repost track'}
              </h2>
              <button
                type="button"
                onClick={() => setShowRepostModal(false)}
                aria-label="Close"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!hasReposted && (
              <textarea
                value={repostCaption}
                onChange={(event) => setRepostCaption(event.target.value)}
                placeholder="Add a note (optional)"
                rows={3}
                maxLength={500}
                className="mb-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowRepostModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={hasReposted ? handleRemoveRepost : handleRepost}>
                {hasReposted ? 'Remove' : 'Repost'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href={`/user/${post.author.id}`}
          aria-label={post.author.username}
          className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted"
        >
          {post.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.author.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs">
            <Link
              href={`/user/${post.author.id}`}
              className="truncate font-medium hover:text-primary"
            >
              {post.author.username}
            </Link>
            <span className="text-muted-foreground/60">·</span>
            <span className="shrink-0 text-muted-foreground">
              {formatRelativeTime(post.createdAt)}
            </span>
          </div>
          <Link
            href={`/post/${post.id}`}
            className="mt-0.5 block truncate text-sm font-semibold hover:text-primary"
          >
            {post.title}
          </Link>
          {metadata && <p className="truncate text-xs text-muted-foreground">{metadata}</p>}
        </div>

        {post.coverArtUrl && (
          <Link
            href={`/post/${post.id}`}
            aria-label={`Open ${post.title}`}
            className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverArtUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </Link>
        )}
      </div>

      <div className="mt-3">
        <UnifiedMusicPlayer
          variant="minimal"
          trackId={post.id}
          src={post.streamUrl}
          title={post.title}
          artist={post.artist}
          poster={post.coverArtUrl}
        />
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-border/60 pt-2">
        <ActionButton
          label={hasLiked ? 'Unlike' : 'Like'}
          count={likesCount}
          active={hasLiked}
          activeClassName="text-rose-500"
          onClick={() => void handleLike()}
          disabled={isLiking}
        >
          <Heart className={`h-4 w-4 ${hasLiked ? 'fill-current' : ''}`} />
        </ActionButton>

        <ActionButton
          label={showComments ? 'Hide comments' : 'Show comments'}
          count={commentsCount}
          active={showComments}
          activeClassName="text-primary"
          onClick={() => setShowComments((value) => !value)}
        >
          <MessageCircle className="h-4 w-4" />
        </ActionButton>

        <ActionButton label="Share" onClick={() => void handleShare()}>
          <Share2 className="h-4 w-4" />
        </ActionButton>

        <ActionButton
          label={hasReposted ? 'Remove repost' : 'Repost'}
          count={repostsCount}
          active={hasReposted}
          activeClassName="text-emerald-500"
          onClick={() => setShowRepostModal(true)}
        >
          <Repeat className={`h-4 w-4 ${hasReposted ? 'fill-current' : ''}`} />
        </ActionButton>
      </div>

      {showComments && (
        <section className="mt-3 border-t border-border/60 pt-3" aria-label="Comments">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmitComment();
            }}
          >
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Add a comment"
              maxLength={1000}
              aria-label="Add a comment"
              className="h-9 min-w-0 flex-1 rounded-full border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            {post.duration > 0 && (
              <button
                type="button"
                onClick={setTimestampFromPlayback}
                aria-label="Add playback timestamp"
                title="Add playback timestamp"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-primary"
              >
                <Clock className="h-4 w-4" />
              </button>
            )}

            <Button
              type="submit"
              size="icon"
              disabled={!commentText.trim() || isSubmittingComment}
              aria-label="Post comment"
              className="h-9 w-9 shrink-0 rounded-full"
            >
              {isSubmittingComment ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {commentTimestamp !== null && (
            <div className="mt-2 flex items-center gap-2 text-xs text-primary">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
                <Clock className="h-3 w-3" />
                At {formatTimestamp(commentTimestamp)}
              </span>
              <button
                type="button"
                onClick={() => setCommentTimestamp(null)}
                aria-label="Remove timestamp"
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {isLoadingComments ? (
            <div className="flex justify-center py-6">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={viewerId}
                  onDelete={handleDeleteComment}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </article>
  );
};

export default EnhancedFeedItem;
