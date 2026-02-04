'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EnhancedFeedItem } from '@/components/feed/EnhancedFeedItem';
import { RepostItem } from '@/components/feed/RepostItem';
import { UnifiedMusicPlayer } from '@/components/player/UnifiedMusicPlayer';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  Music, 
  ArrowLeft, 
  MessageCircle, 
  Heart, 
  Repeat, 
  Share2,
  Clock,
  Send,
  MoreHorizontal,
  CornerDownRight
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
  parentId: string | null;
  replies?: Comment[];
}

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
}

export default function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const unwrappedParams = use(params);
  const [post, setPost] = useState<any>(null);
  const [reposts, setReposts] = useState<any[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();

  useEffect(() => {
    fetchPostData();
  }, [unwrappedParams.postId]);

  const fetchPostData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Fetch post details
      const postResponse = await fetch(`/api/tracks/${unwrappedParams.postId}`, {
        headers
      });

      if (!postResponse.ok) {
        setError('Post not found');
        setIsLoading(false);
        return;
      }

      const postData = await postResponse.json();
      setPost(postData.track);

      // Fetch comments
      const commentsResponse = await fetch(`/api/social/comments?postId=${unwrappedParams.postId}`, {
        headers
      });

      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        // Organize comments into threads
        const rootComments = commentsData.comments.filter((c: Comment) => !c.parentId);
        const replies = commentsData.comments.filter((c: Comment) => c.parentId);
        
        // Attach replies to parent comments
        rootComments.forEach((comment: Comment) => {
          comment.replies = replies.filter((r: Comment) => r.parentId === comment.id);
        });

        setComments(rootComments);
      }

      // Fetch reposts
      const repostsResponse = await fetch(`/api/social/reposts?postId=${unwrappedParams.postId}`, {
        headers
      });

      if (repostsResponse.ok) {
        const repostsData = await repostsResponse.json();
        setReposts(repostsData.reposts || []);
      }
    } catch (err) {
      setError('Failed to load post');
      console.error('Error fetching post:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async (parentId: string | null = null) => {
    if (!commentText.trim()) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please sign in to comment');
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
          postId: unwrappedParams.postId,
          content: commentText.trim(),
          timestampSeconds: null,
          parentId: parentId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        const newComment: Comment = {
          ...data.comment,
          parentId: parentId,
          replies: []
        };

        if (parentId) {
          // Add as reply
          setComments(prev => {
            const updated = [...prev];
            const parentIndex = updated.findIndex(c => c.id === parentId);
            if (parentIndex >= 0) {
              if (!updated[parentIndex].replies) {
                updated[parentIndex].replies = [];
              }
              updated[parentIndex].replies = [newComment, ...updated[parentIndex].replies!];
            }
            return updated;
          });
          setReplyToId(null);
        } else {
          // Add as root comment
          setComments(prev => [newComment, ...prev]);
        }
        
        setCommentText('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to post comment');
      }
    } catch (err) {
      console.error('Comment error:', err);
      alert('Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const formatDuration = (seconds: number): string => {
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

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground mb-4">{error || 'Post not found'}</p>
          <Link href="/feed">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Music className="h-5 w-5" />
              <span className="hidden sm:inline">P2P Music</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Main Post */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 mb-8 shadow-lg">
            {/* Author Info */}
            <div className="flex items-center gap-3 mb-4">
              {post.author?.avatarUrl ? (
                <img
                  src={post.author.avatarUrl}
                  alt={post.author.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <Music className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <Link 
                  href={`/user/${post.author?.id}`}
                  className="font-semibold text-lg hover:text-primary transition-colors"
                >
                  {post.author?.username}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Track Info */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
              <p className="text-muted-foreground text-lg">
                {post.artist} • {post.album}
                {post.genre && ` • ${post.genre}`}
              </p>
              {post.duration > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Duration: {formatDuration(post.duration)}
                </p>
              )}
            </div>

            {/* Cover Art */}
            {post.coverArtUrl && (
              <div className="mb-6">
                <img
                  src={post.coverArtUrl}
                  alt={`${post.title} cover`}
                  className="w-full max-w-md rounded-lg object-cover shadow-md mx-auto"
                />
              </div>
            )}

            {/* Music Player */}
            <div className="mb-6">
              <UnifiedMusicPlayer 
                trackId={post.ipfsCid || post.magnetUri || post.id}
                title={post.title}
                artist={post.artist}
              />
            </div>

            {/* Social Stats */}
            <div className="flex items-center gap-6 py-4 border-t border-b mb-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Heart className="h-5 w-5" />
                <span>{post.likesCount || 0} likes</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="h-5 w-5" />
                <span>{comments.length + (comments.reduce((acc, c) => acc + (c.replies?.length || 0), 0))} comments</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Repeat className="h-5 w-5" />
                <span>{reposts.length} reposts</span>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comments
            </h2>

            {/* Comment Input */}
            <div className="mb-6">
              <div className="relative">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-secondary/50 border-0 rounded-lg px-4 py-3 resize-none focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm min-h-[100px]"
                  maxLength={1000}
                />
                <Button
                  size="sm"
                  onClick={() => handleSubmitComment(null)}
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
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {commentText.length}/1000
              </p>
            </div>

            {/* Threaded Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <ThreadedComment
                    key={comment.id}
                    comment={comment}
                    currentUserId={user?.id}
                    replyToId={replyToId}
                    setReplyToId={setReplyToId}
                    expandedReplies={expandedReplies}
                    toggleReplies={toggleReplies}
                    handleSubmitComment={handleSubmitComment}
                    commentText={commentText}
                    setCommentText={setCommentText}
                    isSubmittingComment={isSubmittingComment}
                    formatRelativeTime={formatRelativeTime}
                    formatDuration={formatDuration}
                  />
                ))
              )}
            </div>
          </div>

          {/* Reposts Section */}
          {reposts.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Repeat className="h-5 w-5" />
                Reposts ({reposts.length})
              </h2>
              <div className="space-y-4">
                {reposts.map((repost) => (
                  <RepostItem key={repost.id} repost={repost} currentUserId={user?.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Threaded Comment Component
function ThreadedComment({
  comment,
  currentUserId,
  replyToId,
  setReplyToId,
  expandedReplies,
  toggleReplies,
  handleSubmitComment,
  commentText,
  setCommentText,
  isSubmittingComment,
  formatRelativeTime,
  formatDuration,
}: {
  comment: Comment;
  currentUserId?: string;
  replyToId: string | null;
  setReplyToId: (id: string | null) => void;
  expandedReplies: Set<string>;
  toggleReplies: (id: string) => void;
  handleSubmitComment: (parentId: string | null) => void;
  commentText: string;
  setCommentText: (text: string) => void;
  isSubmittingComment: boolean;
  formatRelativeTime: (date: string) => string;
  formatDuration: (seconds: number) => string;
}) {
  const isOwner = currentUserId === comment.user.id;
  const hasReplies = comment.replies && comment.replies.length > 0;
  const isExpanded = expandedReplies.has(comment.id);

  return (
    <div className="border-l-2 border-border/50 pl-4 ml-2">
      {/* Comment */}
      <div className="flex gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
        {comment.user.avatarUrl ? (
          <img
            src={comment.user.avatarUrl}
            alt={comment.user.username}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
            <Music className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link 
              href={`/user/${comment.user.id}`}
              className="font-semibold hover:text-primary transition-colors"
            >
              {comment.user.username}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </span>
            {comment.timestampSeconds !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                <Clock className="h-3 w-3" />
                {formatDuration(comment.timestampSeconds)}
              </span>
            )}
          </div>
          <p className="text-sm break-words">{comment.content}</p>
          
          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => setReplyToId(replyToId === comment.id ? null : comment.id)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <CornerDownRight className="h-3 w-3" />
              Reply
            </button>
            {hasReplies && (
              <button
                onClick={() => toggleReplies(comment.id)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {isExpanded ? 'Hide' : 'Show'} {comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>

          {/* Reply Input */}
          {replyToId === comment.id && (
            <div className="mt-3 flex gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={`Reply to ${comment.user.username}...`}
                className="flex-1 bg-secondary/50 border-0 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm min-h-[60px]"
                maxLength={1000}
              />
              <Button
                size="sm"
                onClick={() => handleSubmitComment(comment.id)}
                disabled={!commentText.trim() || isSubmittingComment}
              >
                {isSubmittingComment ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {hasReplies && isExpanded && (
        <div className="mt-2 space-y-2">
          {comment.replies!.map((reply) => (
            <div key={reply.id} className="pl-6 border-l border-border/30 ml-4">
              <ThreadedComment
                comment={reply}
                currentUserId={currentUserId}
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                expandedReplies={expandedReplies}
                toggleReplies={toggleReplies}
                handleSubmitComment={handleSubmitComment}
                commentText={commentText}
                setCommentText={setCommentText}
                isSubmittingComment={isSubmittingComment}
                formatRelativeTime={formatRelativeTime}
                formatDuration={formatDuration}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
