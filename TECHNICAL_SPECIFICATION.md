# Decentralized P2P Music Social Platform

## Technical Specification: Spotify for the Decentralized Web

### 1. Project Overview

A Spotify-like music hosting and social platform utilizing WebTorrent and WebRTC to eliminate central server costs. The platform uses a "Social-Directed Storage" model where users host the music for the artists they follow, using encrypted chunks stored across devices.

**Key Innovation:** Popularity makes the network faster, not more expensive. The social graph (Postgres) coordinates the data swarm (WebTorrent), ensuring music lives on the devices of those who care about it most.

---

### 2. Technology Stack

| Layer | Responsibility | Tech Stack |
|-------|---------------|------------|
| Identity | User Auth, JWT, Profiles | NextAuth.js / Supabase Auth |
| Social Graph | Following, Likes, Comments | PostgreSQL (Prisma ORM) |
| File Engine | Seeding & Torrent Generation | Node.js (WebTorrent-Hybrid) |
| Real-time | Notifications & Live Social Feed | Socket.io / Pusher |
| Frontend | UI and Client-side P2P | Next.js / React |
| P2P Engine | Browser torrenting | webtorrent.js |
| Security | End-to-end encryption | Web Crypto API (AES-256 GCM) |
| Tracker | Peer discovery | Private WebSocket Tracker (bittorrent-tracker) |
| NAT Traversal | Firewall bypass | Coturn STUN/TURN Server |

---

### 3. Core Architecture

#### 3.1 Full-Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SOCIAL LAYER (User IDs, Comments, Likes)                   │
│  ├── NextAuth.js / Supabase Auth                            │
│  ├── PostgreSQL (users, posts, comments, likes, follows)   │
│  └── Socket.io for real-time updates                        │
└──────────────┬──────────────────┬───────────────────────────┘
               │                  │
               ▼                  ▼
    ┌────────────────────┐ ┌────────────────────┐
    │  Nginx Gateway     │ │  Coturn Server     │
    │  (HTTP/WebSocket)  │ │  (P2P Signaling)   │
    └─────────┬──────────┘ └─────────┬──────────┘
              │                      │
              ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│  P2P LAYER (Magnets, Peers)                                 │
│  ├── WebTorrent Client (Browser)                            │
│  ├── Private Tracker (WebSocket)                            │
│  ├── Service Worker (Background Seeding)                    │
│  └── Web Crypto API (AES-256-GCM Encryption)               │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2 Social-Directed Storage Algorithm

Data availability is maintained through user device tiers based on their interaction level:

| Tier | Trigger Action | Storage Type | Data Persistence |
|------|---------------|--------------|------------------|
| Listener | Playback | RAM | Temporary (Session only) |
| Liker | "Heart" / Like | IndexedDB | Persistent (LRU Cache) |
| Follower | "Follow" Artist | IndexedDB | Proactive (Pre-fetches new tracks) |
| Guardian | High Trust Score | IndexedDB | Permanent seeding priority |
| Archivist | Top 1% of seeders | IndexedDB | Governance votes + badge |

#### 3.3 Mutual-Only Gating & Private Swarms

To restrict sharing to mutual followers or specific groups, the Tracker Filter acts as a gatekeeper:

```javascript
// Tracker authorization flow
Peer A requests peer list for InfoHash_X
│
▼
Tracker queries Database:
SELECT 1 FROM follows 
WHERE follower_id = A 
  AND following_id = B 
  AND is_mutual = TRUE
│
▼
Connection only established if is_mutual === true
```

**Private Group Scoping:**
- Each group has a unique `Group_Key`
- Songs are encrypted with the `Group_Key`
- Key only shared with active `membership_id` holders
- Tracker verifies membership before WebRTC signaling

---

### 4. Database Schema

#### 4.1 Core Tables

```sql
-- Users & Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE,
  avatar_url TEXT,
  email TEXT UNIQUE,
  public_key TEXT, -- X25519 for encryption
  private_key_encrypted TEXT, -- User's private key, encrypted
  trust_score INTEGER DEFAULT 0,
  on_trial BOOLEAN DEFAULT FALSE,
  is_founder_user BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Music Posts (Torrent Entries)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  magnet_uri TEXT NOT NULL,
  info_hash TEXT UNIQUE NOT NULL,
  encrypted_file_url TEXT,
  size_bytes BIGINT,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Social Interactions
CREATE TABLE follows (
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_mutual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE likes (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  timestamp_seconds INTEGER, -- For SoundCloud-style timed comments
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.2 Music Preferences & Trust System

```sql
-- Music Preferences for Onboarding & Discovery
CREATE TABLE music_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL CHECK (preference_type IN ('genre', 'artist', 'mood', 'era')),
  preference_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, preference_type, preference_value)
);

-- Trigger to Auto-Update Mutual Status
CREATE OR REPLACE FUNCTION update_mutual_status()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM follows 
             WHERE follower_id = NEW.following_id 
             AND following_id = NEW.follower_id) 
  THEN
    UPDATE follows SET is_mutual = TRUE 
    WHERE (follower_id = NEW.follower_id AND following_id = NEW.following_id)
       OR (follower_id = NEW.following_id AND following_id = NEW.follower_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mutual_check
AFTER INSERT ON follows
FOR EACH ROW EXECUTE FUNCTION update_mutual_status();

-- Index for Mutual Gating Performance
CREATE INDEX idx_mutual_gating ON follows(follower_id, is_mutual) WHERE is_mutual = TRUE;
```

---

### 5. Key Implementation Snippets

#### 5.1 Secure Encryption & Fragmentation

Files are encrypted before leaving the uploader's device. The key is embedded in the "Fragment" identifier of the Magnet Link.

```javascript
// Web Crypto API: Encrypting a track locally
async function encryptAndShard(file) {
  // 1. Generate a high-security key
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  // 2. Encrypt the file buffer
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );

  // 3. Export key for Magnet Link fragment
  const exportedKey = await window.crypto.subtle.exportKey("jwk", key);
  const keyString = btoa(JSON.stringify(exportedKey));

  return {
    encryptedBlob: new Blob([encryptedBuffer]),
    keyString,
    iv: btoa(String.fromCharCode(...iv))
  };
}
```

#### 5.2 User Trust Score (UTS)

```javascript
// UTS Formula: Weighted average of user behaviors
// UTS = (Uptime × 0.5) + (Seeding Ratio × 0.3) + (Hash Accuracy × 0.2)

function calculateUTS(userStats) {
  const U = Math.min(userStats.uptimeHours / 100, 1) * 100; // Normalize to 100h
  const S = Math.min(userStats.uploadedBytes / userStats.downloadedBytes, 2) * 50; // Ratio bonus
  const A = userStats.challengeSuccessRate * 100;
  
  return Math.round((U * 0.5) + (S * 0.3) + (A * 0.2));
}

// Trust Tiers
const TRUST_TIERS = {
  LEECHER: { min: 0, max: 20, badge: '🌑 Newbie' },
  NODE: { min: 21, max: 60, badge: '🛰️ Relay' },
  GUARDIAN: { min: 61, max: 90, badge: '🛡️ Guardian' },
  ARCHIVIST: { min: 91, max: 100, badge: '💎 Diamond Node' }
};
```

#### 5.3 P2P Audio Player with Sequential Streaming

```javascript
// P2PMusicPlayer.js - Allows playback before full download
client.add(magnetURI, { 
  sequential: true, // Critical for audio streaming
  announce: ['wss://tracker.platform.com']
}, (torrent) => {
  const file = torrent.files.find(f => f.name.endsWith('.mp3'));
  file.renderTo('audio#player', { 
    autoplay: true,
    muted: false 
  });
  
  // Expose metadata to React state
  onMetadata({
    name: file.name,
    length: file.length,
    progress: 0,
    peers: torrent.numPeers
  });
});
```

#### 5.4 Proof of Storage Challenge

```javascript
// Verifies users are actually storing encrypted chunks
async function proveStorage(challengeOffset, expectedHash, infoHash) {
  const db = await openIndexedDB();
  const chunk = await db.get('chunks', infoHash);

  if (!chunk) return false;

  // Read specific slice based on challenge
  const slice = chunk.data.slice(challengeOffset, challengeOffset + 1024);
  const buffer = await slice.arrayBuffer();
  
  // Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex === expectedHash;
}
```

#### 5.5 Trigger-Based Distribution

```javascript
// SocialSyncWorker.js - Handles social -> storage mapping
const handleSocialAction = async (action, data) => {
  switch(action) {
    case 'FOLLOW_ARTIST':
      // Proactively download 5MB of artist's top tracks
      await swarmManager.preFetch(data.artistId, { depth: 'aggressive' });
      break;
    
    case 'LIKE_GENRE':
      // Join genre swarm for network health
      await swarmManager.joinSwarm(`genre:${data.genreName}`, { quota: '50MB' });
      break;

    case 'LIKE_TRACK':
      // Move from RAM to IndexedDB
      await persistToDevice(data.torrent);
      break;

    case 'UPDATE_PREFERENCES':
      // Clear cache for changed tastes
      await swarmManager.pruneCache(data.newPreferences);
      break;
  }
};
```

---

### 6. Backend API Implementation

#### 6.1 Like Handler with Swarm Reward

```javascript
// routes/interactions.js
app.post('/api/like', authenticateUser, async (req, res) => {
  const { postId } = req.body;
  const userId = req.user.id;

  try {
    // 1. Record the like in PostgreSQL
    await db.likes.create({
      data: { userId, postId }
    });

    // 2. Check if user qualifies for "Swarm Supporter" badge
    const userLikes = await db.likes.count({ where: { userId } });
    
    let awardedBadge = null;
    if (userLikes >= 5) {
      awardedBadge = "Swarm Supporter";
      await db.users.update({
        where: { id: userId },
        data: { badge: awardedBadge }
      });
    }

    // 3. Trigger background seeding
    await notifyServiceWorker(userId, postId, 'SEED_TRACK');

    res.json({ success: true, badge: awardedBadge });
  } catch (err) {
    res.status(400).json({ error: "Already liked or system error" });
  }
});
```

#### 6.2 Onboarding Verification

```javascript
/**
 * Verifies if user has completed required steps to unlock uploads
 * Founders (first 11 users) skip this check
 */
async function verifyOnboardingStatus(userId, db) {
  const user = await db.users.findUnique({ where: { id: userId } });

  // Exemption for Founder Users
  if (user.is_founder_user) {
    return { canUpload: true, reason: 'founder_status' };
  }

  const [prefCount, followCount] = await Promise.all([
    db.music_preferences.count({ where: { user_id: userId } }),
    db.follows.count({ where: { follower_id: userId } })
  ]);

  const isComplete = prefCount >= 5 && followCount >= 10;

  if (isComplete && !user.onboarding_completed) {
    await db.users.update({
      where: { id: userId },
      data: { 
        onboarding_completed: true, 
        can_upload: true,
        on_trial: false
      }
    });
  }

  return {
    complete: isComplete,
    canUpload: isComplete || user.can_upload,
    progress: { preferences: prefCount, follows: followCount }
  };
}
```

#### 6.3 Admin Swarm Health Endpoint

```javascript
// On your Tracker Server
server.on('listening', () => {
  app.get('/admin/swarm-health', authenticateUser, authorizeAdmin, (req, res) => {
    // server.torrents is a map of all active swarms
    const healthReport = Object.keys(server.torrents).map(hash => {
      const swarm = server.torrents[hash];
      return {
        infoHash: hash,
        seeders: swarm.complete,
        leechers: swarm.incomplete,
        healthScore: swarm.complete > 0 ? 'Healthy' : 'Critical'
      };
    });
    res.json(healthReport);
  });
});
```

#### 6.4 Optimized Tracker Query for Mutual Gating

```sql
-- Only returns peers in mutual relationships
SELECT p.id, p.magnet_uri, u.trust_score, u.username
FROM posts p
JOIN follows f ON f.following_id = p.author_id
JOIN users u ON u.id = p.author_id
WHERE f.follower_id = :requester_id 
  AND f.is_mutual = TRUE 
  AND p.info_hash = :target_hash;
```

---

### 7. Frontend Components

#### 7.1 Onboarding Flow (Zustand + shadcn/ui)

```typescript
// stores/onboarding.ts
import { create } from 'zustand';

interface OnboardingState {
  preferences: string[];
  follows: number;
  isComplete: boolean;
  updateProgress: (prefs: string[], follows: number, complete: boolean) => void;
  addPreference: (pref: string) => void;
  incrementFollows: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  preferences: [],
  follows: 0,
  isComplete: false,
  
  updateProgress: (prefs, followsCount, complete) => set({
    preferences: prefs,
    follows: followsCount,
    isComplete: complete
  }),

  addPreference: (pref) => set((state) => ({
    preferences: [...state.preferences, pref]
  })),

  incrementFollows: () => set((state) => ({
    follows: state.follows + 1
  }))
}));
```

```typescript
// components/onboarding/PreferenceStep.tsx
'use client';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from '@/stores/onboarding';

const GENRES = ['Rock', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical', 'Pop', 'R&B', 'Indie'];

export const PreferenceStep = () => {
  const { preferences, addPreference } = useOnboardingStore();
  const progress = (preferences.length / 5) * 100;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">What do you vibe with?</h2>
        <span className="text-sm font-medium">{preferences.length}/5 selected</span>
      </div>
      <Progress value={progress} className="h-2" />
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {GENRES.map((genre) => (
          <Button
            key={genre}
            variant={preferences.includes(genre) ? "default" : "outline"}
            onClick={() => addPreference(genre)}
            className="h-auto py-4"
          >
            {genre}
          </Button>
        ))}
      </div>

      {progress === 100 && (
        <div className="text-center text-green-600 font-medium animate-pulse">
          Perfect! Let's build your circle next.
        </div>
      )}
    </div>
  );
};
```

#### 7.2 Feed Item with Social Actions

```typescript
// components/feed/FeedItem.tsx
'use client';
import { useState } from 'react';
import { P2PMusicPlayer } from './P2PMusicPlayer';

interface Post {
  id: string;
  title: string;
  magnet_uri: string;
  author: {
    username: string;
    avatar: string;
  };
  likes_count: number;
  comments_count: number;
}

export const FeedItem = ({ post }: { post: Post }) => {
  const [hasLiked, setHasLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleLike = async () => {
    const res = await fetch('/api/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id })
    });
    const data = await res.json();
    setHasLiked(true);
    if (data.badge) {
      // Show achievement notification
      toast.success(`🏆 Achievement Unlocked: ${data.badge}!`);
    }
  };

  return (
    <div className="music-post-card bg-white rounded-lg shadow-sm p-6 mb-4">
      <div className="user-info flex items-center gap-3 mb-4">
        <img 
          src={post.author.avatar} 
          alt="avatar" 
          className="w-10 h-10 rounded-full"
        />
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{post.author.username}</span>
          {' '}uploaded a new track!
        </p>
      </div>

      <h3 className="text-xl font-bold mb-4">{post.title}</h3>

      <P2PMusicPlayer magnetURI={post.magnet_uri} />

      <div className="social-actions flex gap-4 mt-4">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-1 transition-colors ${
            hasLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-500'
          }`}
        >
          <Heart className={hasLiked ? 'fill-current' : ''} size={20} />
          {post.likes_count + (hasLiked ? 1 : 0)}
        </button>

        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 text-slate-400 hover:text-blue-500"
        >
          <MessageCircle size={20} />
          {post.comments_count}
        </button>

        <button 
          onClick={() => navigator.clipboard.writeText(post.magnet_uri)}
          className="flex items-center gap-1 text-slate-400 hover:text-green-500"
          title="Copy Magnet Link"
        >
          <Link size={20} />
          Share Magnet
        </button>
      </div>

      {showComments && <CommentSection postId={post.id} />}
    </div>
  );
};
```

#### 7.3 Like Button with Seeding Status

```typescript
// components/social/LikeButton.tsx
'use client';
import { useState } from 'react';

interface LikeButtonProps {
  post: Post;
  isSeeding: boolean;
}

export const LikeButton = ({ post, isSeeding }: LikeButtonProps) => {
  const [liked, setLiked] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  const handleLike = async () => {
    const res = await fetch('/api/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id })
    });
    const data = await res.json();
    
    setLiked(true);
    if (data.badge) setShowBadge(true);
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleLike}
        className={`flex items-center gap-2 p-2 rounded-full transition-all ${
          liked ? 'bg-red-50 text-red-500' : 'text-slate-400 hover:bg-slate-50'
        }`}
      >
        <Heart className={liked ? 'fill-current' : ''} size={24} />
        <span className="font-medium">{liked ? post.likes + 1 : post.likes}</span>
      </button>

      {/* Gamification: Active seeding indicator */}
      {isSeeding && liked && (
        <span className="text-xs text-green-600 font-medium animate-pulse mt-1">
          ⚡ You are actively supporting this swarm
        </span>
      )}
      
      {showBadge && (
        <div className="mt-2 px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full text-xs font-medium text-yellow-700">
          🏆 Swarm Supporter Badge Unlocked!
        </div>
      )}
    </div>
  );
};
```

#### 7.4 Artist Dashboard

```typescript
// app/upload/page.tsx
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UploadCloud } from "lucide-react";
import { useOnboardingStore } from '@/store/onboarding';

export default function ArtistDashboard() {
  const [isUploading, setIsUploading] = useState(false);
  const { isComplete } = useOnboardingStore();

  if (!isComplete) return <OnboardingGate />;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Artist Studio</h1>
        <Badge variant="outline">Trust Score: 85 (Guardian)</Badge>
      </header>

      {/* Drag & Drop Upload Zone */}
      <Card className="border-dashed border-2 bg-slate-50/50">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <UploadCloud className="h-12 w-12 text-slate-400 mb-4" />
          <p className="text-sm text-slate-600">Drag your .mp3 or .flac here</p>
          <Input 
            type="file" 
            className="hidden" 
            id="audio-upload" 
            accept="audio/*"
            onChange={(e) => handleFileUpload(e.target.files?.[0])} 
          />
          <Button onClick={() => document.getElementById('audio-upload')?.click()}>
            Select Track
          </Button>
        </CardContent>
      </Card>

      {/* Active Tracks & Swarm Health */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Your Distributed Tracks</h2>
        <div className="grid gap-4">
          {tracks.map(track => (
            <TrackManagementItem key={track.id} track={track} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

#### 7.5 Network Health Visualization

```typescript
// components/admin/SwarmHealthChart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface PeerData {
  uts: number; // User Trust Score
  id: string;
  username: string;
}

export const SwarmHealthChart = ({ peers }: { peers: PeerData[] }) => {
  const data = [
    { name: 'Guardians (High Trust)', value: peers.filter(p => p.uts > 60).length, color: '#22c55e' },
    { name: 'Nodes (Mutuals)', value: peers.filter(p => p.uts > 20 && p.uts <= 60).length, color: '#3b82f6' },
    { name: 'Listeners (Ephemeral)', value: peers.filter(p => p.uts <= 20).length, color: '#94a3b8' },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center mt-2">
        <p className="text-sm font-medium text-slate-600">Swarm Distribution</p>
      </div>
    </div>
  );
};
```

---

### 8. Service Worker: Background P2P Seeding

```javascript
// public/sw.js - P2P Persistence Layer
import { WebTorrent } from 'webtorrent';

let client = null;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  // Initialize background client
  if (!client) client = new WebTorrent({ dht: false }); 
});

// Use WebLocks to ensure only one "Background Seeder" exists per device
self.addEventListener('message', async (event) => {
  if (event.data.type === 'START_SEEDING') {
    await navigator.locks.request('p2p_seed_lock', async () => {
      const { magnetURI, encryptedBlob } = event.data;
      
      if (!client.get(magnetURI)) {
        client.seed(encryptedBlob, { announce: event.data.trackers }, (torrent) => {
          console.log(`Worker actively seeding: ${torrent.infoHash}`);
        });
      }
    });
  }
});

// Keep-alive for background seeding
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'p2p-seed') {
    // Continue seeding high-priority tracks
    event.waitUntil(seedQueuedTracks());
  }
});
```

**Main Thread Integration:**

```javascript
// Main Thread Logic
window.addEventListener('beforeunload', () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Tell worker to keep seeding these specific high-priority tracks
    navigator.serviceWorker.controller.postMessage({
      type: 'START_SEEDING',
      magnetURI: currentTrack.magnetURI,
      trackers: ['wss://tracker.yourplatform.com'],
      encryptedBlob: cachedBlobFromIndexedDB
    });
  }
});
```

---

### 9. Deployment Architecture

#### 9.1 Nginx Configuration

```nginx
# /etc/nginx/sites-available/music-platform
server {
    listen 443 ssl http2;
    server_name platform.example.com;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/platform.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/platform.example.com/privkey.pem;

    # 1. Next.js Web App & Fastify API
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 2. WebSocket P2P Tracker (Crucial for WebTorrent)
    location /tracker {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        
        # Increase timeouts for long-lived P2P connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

#### 9.2 Docker Compose

```yaml
version: '3.8'
services:
  # 1. The Central Database
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # 2. The Private Tracker (Peer Discovery)
  tracker:
    build: ./tracker-service
    ports:
      - "8000:8000"
      - "8000:8000/udp"
    depends_on:
      - db

  # 3. Coturn TURN Server
  coturn:
    image: coturn/coturn:latest
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf

  # 4. The Web UI (Next.js)
  app:
    build: ./web-app
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      TRACKER_URL: wss://tracker.${DOMAIN}
    depends_on:
      - db
      - tracker

volumes:
  pgdata:
```

#### 9.3 Coturn Configuration

```bash
# turnserver.conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=turnuser:turnpassword
realm=platform.example.com
total-quota=100
bps-capacity=0
stale-nonce
```

---

### 10. User Experience Flow

#### 10.1 Artist Upload Experience

1. **File Selection:** Artist drags MP3 into the dashboard
2. **Encryption:** Browser generates AES-256 key, encrypts file
3. **Chunking:** File split into encrypted chunks
4. **Magnet Generation:** Creates URI with decryption key in fragment
5. **Initial Seeding:** Browser becomes first peer
6. **Database Entry:** Post saved with magnet URI and metadata
7. **Mutual Notification:** Followers receive real-time alert
8. **Proactive Mirroring:** Followers' devices pre-fetch the track

#### 10.2 Listener Experience

1. **Discovery:** User sees track in feed (social graph filter applied)
2. **Playback Click:** Browser joins swarm via WebSocket tracker
3. **Chunk Assembly:** Collects encrypted pieces from multiple peers
4. **Decryption:** Reconstructs original file using key from magnet
5. **Streaming:** Audio plays as sequential chunks arrive
6. **Seeding:** After listening, user becomes a seeder automatically
7. **Social Actions:** User can like, comment, or share (copies magnet)

#### 10.3 The "Spotify Moment"

- **Low Popularity:** New tracks rely on the artist's device and a few Guardians
- **High Popularity:** 1,000 listeners = 1,000 seeders = near-zero server bandwidth
- **Viral Growth:** More listeners = faster download speeds for everyone

---

### 11. Security & Privacy

#### 11.1 End-to-End Encryption

- All files encrypted client-side with AES-256-GCM
- Decryption key embedded in magnet URI fragment
- Even storage nodes cannot access raw audio
- Only valid social graph members can request chunks

#### 11.2 Privacy-Preserving Preferences

- Bloom Filters used for taste matching
- Users don't reveal exact playlist to network
- Merkle Trees verify chunk integrity on transfer

#### 11.3 Anti-Leeching Measures

- Proof of Storage challenges verify actual file possession
- Trust Score calculated from uptime, ratio, and accuracy
- Low-score users receive reduced download priority

---

### 12. Launch Checklist

- [ ] SSL certificates configured via Let's Encrypt
- [ ] Coturn STUN/TURN servers deployed
- [ ] PostgreSQL schema migrated with proper indexes
- [ ] Private WebSocket tracker operational
- [ ] Service Worker registered for background seeding
- [ ] Onboarding flow validates 5 preferences + 10 follows
- [ ] Mutual relationship trigger functional
- [ ] Trust Score calculation running in background
- [ ] Admin dashboard showing swarm health
- [ ] Mobile PWA manifest configured

---

### 13. Project Status

This document represents the complete technical specification for the **Decentralized P2P Music Social Platform**. The implementation covers:

1. ✅ **Social Graph Layer** - PostgreSQL schema with mutual following logic
2. ✅ **P2P Engine** - WebTorrent integration with sequential streaming
3. ✅ **Security** - AES-256-GCM encryption with Web Crypto API
4. ✅ **Frontend** - React components for feed, onboarding, and dashboard
5. ✅ **Backend** - API routes for likes, follows, and onboarding
6. ✅ **Trust System** - UTS calculation with gamification tiers
7. ✅ **Background Seeding** - Service Worker implementation
8. ✅ **Deployment** - Docker Compose with Nginx configuration

**Next Steps for Production:**
- Implement X25519 key exchange for mutual authentication
- Add geographic peer distribution visualization
- Implement mobile deep linking for PWA
- Set up automated backup of artist metadata to IPFS

---

*Generated from the technical discussions for the "Spotify for the Decentralized Web" project.*
