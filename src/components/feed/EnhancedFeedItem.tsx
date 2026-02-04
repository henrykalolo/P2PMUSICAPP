'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { UnifiedMusicPlayer } from '@/components/player/UnifiedMusicPlayer';
import { StorageSystem } from '@/lib/storage/unifiedStorage';
import { Button } from '@/components/ui/button';
import {
  Heart,
  MessageCircle,
  Share2,
  User,
  Send,
  Clock,
  Check,
  Copy,
  Link as LinkIcon,
  X,
  Zap,
  Award,
  MoreHorizontal,
  Trash2,
  Repeat
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

// Types
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

interface BadgeNotification {
  badge: string;
  message: string;
}

interface FeedItemProps {
  post: {
    id: string;
    title: string;
    artist: string;
    album: string;
    genre: string;
    duration: number;
    magnetUri?: string;
    ipfsCid?: string;
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

// Utility functions
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Toast Notification Component
const Toast: React.FC<{
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div
      className={`fixed bottom-4 right-4 ${bgColors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 z-50`}
    >
      {type === 'success' && <Check className="h-4 w-4" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Badge Notification Component
const BadgeNotification: React.FC<{
  badge: BadgeNotification;
  onClose: () => void;
}> = ({ badge, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right z-50 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="bg-white/20 p-2 rounded-full">
          <Award className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-lg">Achievement Unlocked!</h4>
          <p className="text-white/90 text-sm mt-1">{badge.message}</p>
          <div className="mt-2 inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
            <Award className="h-3 w-3" />
            {badge.badge}
          </div>
        </div>
        <button onClick={onClose} className="hover:opacity-70">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

// Share Modal Component
const ShareModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  magnetUri: string;
  postId: string;
  title: string;
  onCopy: (text: string, label: string) => void;
}> = ({ isOpen, onClose, magnetUri, postId, title, onCopy }) => {
  if (!isOpen) return null;

  const shareableUrl = `${window.location.origin}/track/${postId}`;

  const shareOptions = [
    {
      label: 'Copy Magnet Link',
      icon: Copy,
      action: () => onCopy(magnetUri, 'Magnet link copied!'),
      description: 'Share via torrent clients',
    },
    {
      label: 'Copy Track URL',
      icon: LinkIcon,
      action: () => onCopy(shareableUrl, 'Track URL copied!'),
      description: 'Share on social media',
    },
  ];

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Check out "${title}" on P2PMusic`,
          text: `Listen to "${title}" on P2PMusic - Decentralized music streaming`,
          url: shareableUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in-95">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Share Track</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {shareOptions.map((option) => (
            <button
              key={option.label}
              onClick={option.action}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left"
            >
              <div className="p-2 bg-primary/10 rounded-lg">
                <option.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </button>
          ))}

          {'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left border-t mt-2 pt-4"
            >
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Share2 className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Share via...</p>
                <p className="text-xs text-muted-foreground">Use native share dialog</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Comment Item Component
const CommentItem: React.FC<{
  comment: Comment;
  currentUserId?: string;
  onDelete?: (commentId: string) => void;
  trackDuration?: number;
}> = ({ comment, currentUserId, onDelete, trackDuration }) => {
  const isOwner = currentUserId === comment.user.id;
  const hasTimestamp = comment.timestampSeconds !== null && comment.timestampSeconds >= 0;

  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group">
      {/* Avatar */}
      {comment.user.avatarUrl ? (
        <img
          src={comment.user.avatarUrl}
          alt={comment.user.username}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Content */}
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link 
            href={`/user/${comment.user.id}`} 
            className="font-semibold text-sm hover:text-primary transition-colors"
          >
            {comment.user.username}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {hasTimestamp && (
            <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" />
              {formatTimestamp(comment.timestampSeconds!)}
            </span>
          )}
        </div>
        <p className="text-sm mt-1 break-words">{comment.content}</p>
      </div>

      {/* Actions */}
      {isOwner && onDelete && (
        <button
          onClick={() => onDelete(comment.id)}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-500 rounded transition-all"
          title="Delete comment"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

// Main Enhanced FeedItem Component
export const EnhancedFeedItem: React.FC<FeedItemProps> = ({ post, currentUserId }) => {
  // State
  const [hasLiked, setHasLiked] = useState(post.userHasLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [badgeNotification, setBadgeNotification] = useState<BadgeNotification | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(0);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostCaption, setRepostCaption] = useState('');
  
  // Refs
  const commentsRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Get seeding status from player store
  const { isSeeding: globalIsSeeding, currentTrack } = usePlayerStore();
  const isCurrentlyPlaying = currentTrack?.magnetUri === post.magnetUri;
  const isSeeding = isCurrentlyPlaying && globalIsSeeding;

  // Fetch comments when comments section is opened
  const fetchComments = useCallback(async () => {
    if (!showComments) return;
    
    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/social/comments?postId=${post.id}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
        setCommentsCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      setToast({ message: 'Failed to load comments', type: 'error' });
    } finally {
      setIsLoadingComments(false);
    }
  }, [post.id, showComments]);

  // Fetch repost count
  const fetchRepostCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const options: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await fetch(`/api/social/repost?postId=${post.id}`, options);
      if (response.ok) {
        const data = await response.json();
        setRepostsCount(data.repostsCount);
        setHasReposted(data.userHasReposted);
      }
    } catch (error) {
      console.error('Failed to fetch repost count:', error);
    }
  }, [post.id]);

  useEffect(() => {
    fetchComments();
    fetchRepostCount();
  }, [fetchComments, fetchRepostCount]);

  // Handle repost
  const handleRepost = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setToast({ message: 'Please sign in to repost', type: 'error' });
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
          caption: repostCaption.trim() || null
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRepostsCount(data.repostsCount);
        setHasReposted(true);
        setShowRepostModal(false);
        setRepostCaption('');
        setToast({ message: 'Reposted successfully!', type: 'success' });
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Failed to repost', type: 'error' });
      }
    } catch (error) {
      console.error('Repost error:', error);
      setToast({ message: 'Failed to repost', type: 'error' });
    }
  };

  // Handle remove repost
  const handleRemoveRepost = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`/api/social/repost?postId=${post.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRepostsCount(data.repostsCount);
        setHasReposted(false);
        setToast({ message: 'Repost removed', type: 'success' });
      }
    } catch (error) {
      console.error('Remove repost error:', error);
      setToast({ message: 'Failed to remove repost', type: 'error' });
    }
  };

  // Handle like/unlike
  const handleLike = async () => {
    if (isLiking) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      setToast({ message: 'Please sign in to like tracks', type: 'error' });
      return;
    }

    setIsLiking(true);
    
    try {
      if (hasLiked) {
        // Unlike
        const response = await fetch(`/api/social/like?postId=${post.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setHasLiked(false);
          setLikesCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        // Like
        const response = await fetch('/api/social/like', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ postId: post.id }),
        });

        if (response.ok) {
          const data = await response.json();
          setHasLiked(true);
          setLikesCount(data.likesCount || likesCount + 1);
          
          // Show badge notification if earned
          if (data.awardedBadge && data.badgeMessage) {
            setBadgeNotification({
              badge: data.awardedBadge,
              message: data.badgeMessage,
            });
          }
        }
      }
    } catch (error) {
      console.error('Like error:', error);
      setToast({ message: 'Failed to update like', type: 'error' });
    } finally {
      setIsLiking(false);
    }
  };

  // Handle comment submission
  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      setToast({ message: 'Please sign in to comment', type: 'error' });
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

      if (response.ok) {
        const data = await response.json();
        setComments((prev) => [data.comment, ...prev]);
        setCommentsCount(data.commentsCount);
        setCommentText('');
        setCommentTimestamp(null);
        setToast({ message: 'Comment posted!', type: 'success' });
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Failed to post comment', type: 'error' });
      }
    } catch (error) {
      console.error('Comment error:', error);
      setToast({ message: 'Failed to post comment', type: 'error' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle comment deletion
  const handleDeleteComment = async (commentId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`/api/social/comments?id=${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentsCount((prev) => Math.max(0, prev - 1));
        setToast({ message: 'Comment deleted', type: 'success' });
      }
    } catch (error) {
      console.error('Delete comment error:', error);
      setToast({ message: 'Failed to delete comment', type: 'error' });
    }
  };

  // Handle copy to clipboard
  const handleCopy = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ message: successMessage, type: 'success' });
      setShowShareModal(false);
    } catch (err) {
      setToast({ message: 'Failed to copy to clipboard', type: 'error' });
    }
  };

  // Handle key press in comment input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  // Set timestamp from current playback position
  const setTimestampFromPlayback = () => {
    const { currentTrack, progress } = usePlayerStore.getState();
    if (currentTrack?.magnetUri === post.magnetUri && post.duration > 0) {
      const currentSeconds = Math.floor((progress / 100) * post.duration);
      setCommentTimestamp(currentSeconds);
    }
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 mb-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Badge Notification */}
      {badgeNotification && (
        <BadgeNotification
          badge={badgeNotification}
          onClose={() => setBadgeNotification(null)}
        />
      )}

        {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        magnetUri={post.magnetUri || ''}
        postId={post.id}
        title={post.title}
        onCopy={handleCopy}
      />

        {/* Repost Modal */}
      {showRepostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Repost Track</h3>
              <button
                onClick={() => setShowRepostModal(false)}
                className="p-1 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Add a comment (optional)
              </label>
              <textarea
                value={repostCaption}
                onChange={(e) => setRepostCaption(e.target.value)}
                placeholder="What do you think about this track?"
                className="w-full min-h-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {repostCaption.length}/500 characters
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRepostModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleRepost}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Repeat className="h-4 w-4 mr-2" />
                Repost
              </Button>
            </div>
          </div>
        </div>
      )}

         {/* Author Info */}
      <div className="flex items-center gap-3 mb-4">
        {post.author.avatarUrl ? (
          <img
            src={post.author.avatarUrl}
            alt={post.author.username}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <Link 
            href={`/user/${post.author.id}`} 
            className="font-semibold hover:text-primary transition-colors"
          >
            {post.author.username}
          </Link>
          <p className="text-xs text-muted-foreground">
            {new Date(post.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        
        {/* Seeding Badge */}
        {isSeeding && (
          <div className="flex items-center gap-1.5 bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full text-xs font-medium animate-pulse">
            <Zap className="h-3.5 w-3.5 fill-current" />
            Seeding
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="mb-4">
        <h3 className="text-lg font-bold">{post.title}</h3>
        <p className="text-muted-foreground">
          {post.artist} • {post.album}
          {post.genre && ` • ${post.genre}`}
        </p>
        {post.duration > 0 && (
          <p className="text-sm text-muted-foreground">
            Duration: {formatDuration(post.duration)}
          </p>
        )}
      </div>

      {/* Cover Art */}
      {post.coverArtUrl && (
        <div className="mb-4">
          <img
            src={post.coverArtUrl}
            alt={`${post.title} cover`}
            className="w-full max-w-md rounded-lg object-cover shadow-md"
          />
        </div>
      )}

      {/* P2P Player - Shows for all storage systems with fallback */}
      <div className="mb-4">
        {post.ipfsCid ? (
          <UnifiedMusicPlayer 
            trackId={post.ipfsCid} 
            title={post.title}
            artist={post.artist}
            preferredStorage={StorageSystem.IPFS}
            serverStorageId={post.serverStorageId}
          />
        ) : post.magnetUri ? (
          <UnifiedMusicPlayer 
            trackId={post.magnetUri} 
            title={post.title}
            artist={post.artist}
            preferredStorage={StorageSystem.WEB_TORRENT}
            serverStorageId={post.serverStorageId}
          />
        ) : post.storageType === 'local' || post.storageType === 'indexeddb' ? (
          <UnifiedMusicPlayer 
            trackId={`local-${post.id}`} 
            title={post.title}
            artist={post.artist}
            preferredStorage={StorageSystem.INDEXED_DB}
            serverStorageId={post.serverStorageId}
          />
        ) : post.storageType === 'cache-api' ? (
          <UnifiedMusicPlayer 
            trackId={`cache-${post.id}`} 
            title={post.title}
            artist={post.artist}
            preferredStorage={StorageSystem.CACHE_API}
            serverStorageId={post.serverStorageId}
          />
        ) : (
          /* Fallback: try using track ID directly for any other storage type */
          <UnifiedMusicPlayer 
            trackId={post.id} 
            title={post.title}
            artist={post.artist}
            serverStorageId={post.serverStorageId}
          />
        )}
      </div>

         {/* Social Actions */}
      <div className="flex items-center gap-2 pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          disabled={isLiking}
          className={`group transition-all ${
            hasLiked ? 'text-red-500 hover:text-red-600' : 'hover:text-red-500'
          }`}
        >
          <Heart
            className={`h-4 w-4 mr-2 transition-all ${
              hasLiked ? 'fill-current scale-110' : 'group-hover:scale-110'
            }`}
          />
          <span className="tabular-nums">{likesCount}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className={`transition-all ${showComments ? 'text-primary' : ''}`}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          <span className="tabular-nums">{commentsCount}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowShareModal(true)}
          className="hover:text-blue-500 transition-colors"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRepostModal(true)}
          className="hover:text-green-500 transition-colors"
        >
          <Repeat className="h-4 w-4 mr-2" />
          Repost
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => hasReposted ? handleRemoveRepost() : setShowRepostModal(true)}
          className={`transition-all ${
            hasReposted ? 'text-green-500 hover:text-green-600' : 'hover:text-green-500'
          }`}
        >
          <Repeat
            className={`h-4 w-4 mr-2 transition-all ${
              hasReposted ? 'fill-current' : ''
            }`}
          />
          <span className="tabular-nums">{repostsCount}</span>
        </Button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div
          ref={commentsRef}
          className="mt-4 pt-4 border-t animate-in slide-in-from-top-2"
        >
          {/* Comment Input */}
          <div className="mb-4">
            <div className="relative">
              <textarea
                ref={commentInputRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment..."
                className="w-full bg-secondary/50 border-0 rounded-lg px-4 py-3 pr-24 resize-none focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm min-h-[80px]"
                maxLength={1000}
              />
              
              {/* Timestamp Button */}
              {post.duration > 0 && (
                <button
                  onClick={setTimestampFromPlayback}
                  className="absolute bottom-3 left-3 text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  title="Add current playback timestamp"
                >
                  <Clock className="h-3 w-3" />
                  Add timestamp
                </button>
              )}
              
              {/* Submit Button */}
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || isSubmittingComment}
                className="absolute bottom-3 right-3"
              >
                {isSubmittingComment ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Selected Timestamp Display */}
            {commentTimestamp !== null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                  <Clock className="h-3 w-3" />
                  At {formatTimestamp(commentTimestamp)}
                </span>
                <button
                  onClick={() => setCommentTimestamp(null)}
                  className="text-xs text-muted-foreground hover:text-red-500"
                >
                  Remove
                </button>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {commentText.length}/1000
            </p>
          </div>

          {/* Comments List */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {isLoadingComments ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onDelete={handleDeleteComment}
                  trackDuration={post.duration}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedFeedItem;
