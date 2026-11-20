'use client';

import React from 'react';
import Link from 'next/link';
import { EnhancedFeedItem } from './EnhancedFeedItem';
import { Repeat } from 'lucide-react';

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
      ipfsCid?: string;
      streamUrl?: string | null;
      storageType?: string;
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
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Repeat className="h-3.5 w-3.5 shrink-0" />
        <Link
          href={`/user/${repost.reposter.id}`}
          className="truncate font-medium text-foreground hover:text-primary"
        >
          {repost.reposter.username}
        </Link>
        <span>reposted</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="shrink-0">{new Date(repost.createdAt).toLocaleDateString()}</span>
      </div>

      {repost.caption && <p className="mb-2 text-sm">{repost.caption}</p>}

      <EnhancedFeedItem post={repost.originalPost} currentUserId={currentUserId} />
    </div>
  );
};
