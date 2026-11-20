'use client';

import React, { useState } from 'react';
import { UnifiedMusicPlayer } from '@/components/player/UnifiedMusicPlayer';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, User } from 'lucide-react';

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
    coverArtUrl?: string;
    createdAt: string;
    author: {
      id: string;
      username: string;
      avatarUrl?: string;
    };
    likesCount: number;
    commentsCount: number;
  };
}

export const FeedItem: React.FC<FeedItemProps> = ({ post }) => {
  const [hasLiked, setHasLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleLike = async () => {
    try {
      const response = await fetch('/api/social/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ postId: post.id }),
      });

      if (response.ok) {
        setHasLiked(true);
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleShare = async () => {
    const shareText = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(shareText);
      alert('Link copied to clipboard!');
    } catch {
      alert('Unable to copy link');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-card border rounded-lg p-4 mb-4">
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
        <div>
          <p className="font-semibold">{post.author.username}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </div>
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
            className="w-full max-w-md rounded-lg object-cover"
          />
        </div>
      )}

      {/* Player */}
      <div className="mb-4">
        <UnifiedMusicPlayer
          trackId={post.id}
          src={post.streamUrl}
          title={post.title}
          artist={post.artist}
          poster={post.coverArtUrl}
        />
      </div>

      {/* Social Actions */}
      <div className="flex items-center gap-4 pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={hasLiked ? 'text-red-500' : ''}
        >
          <Heart className={`h-4 w-4 mr-2 ${hasLiked ? 'fill-current' : ''}`} />
          {post.likesCount + (hasLiked ? 1 : 0)}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          {post.commentsCount}
        </Button>

        <Button variant="ghost" size="sm" onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Comments coming soon...
          </p>
        </div>
      )}
    </div>
  );
};

export default FeedItem;
