'use client';

import React from 'react';
import Link from 'next/link';
import { EnhancedFeedItem } from './EnhancedFeedItem';
import { Repeat, User } from 'lucide-react';

interface RepostItemProps {
  repost: {
    id: string;
    userId: string;
    postId: string;
    caption: string | null;
    createdAt: string;
    reposter: {
      id: string;
      username: string;
      avatarUrl?: string;
      badge: string;
    };
    originalPost: {
      id: string;
      title: string;
      artist: string;
      album: string;
      genre: string;
      duration: number;
      magnetUri?: string;
      ipfsCid?: string;
      coverArtUrl?: string;
      createdAt: string;
      likesCount: number;
      commentsCount: number;
      repostsCount: number;
      author: {
        id: string;
        username: string;
        avatarUrl?: string;
        badge: string;
      };
    };
  };
  currentUserId?: string;
}

export const RepostItem: React.FC<RepostItemProps> = ({ repost, currentUserId }) => {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-6 mb-6 shadow-lg">
      {/* Repost Header */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Repeat className="h-4 w-4" />
        <span>
          <Link 
            href={`/user/${repost.reposter.id}`}
            className="font-semibold text-foreground hover:text-primary transition-colors"
          >
            {repost.reposter.username}
          </Link>
          {' reposted'}
        </span>
      </div>

      {/* Repost Caption */}
      {repost.caption && (
        <div className="mb-4">
          <p className="text-sm">{repost.caption}</p>
        </div>
      )}

      {/* Original Post */}
      <div className="bg-muted/30 rounded-lg p-4">
        <EnhancedFeedItem 
          post={repost.originalPost}
          currentUserId={currentUserId}
        />
      </div>

      {/* Original Poster Credit */}
      <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
        <User className="h-3 w-3" />
        <span>Original post by </span>
        <Link 
          href={`/user/${repost.originalPost.author.id}`}
          className="font-semibold hover:text-primary transition-colors"
        >
          {repost.originalPost.author.username}
        </Link>
      </div>
    </div>
  );
};
