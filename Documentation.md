# Decentralized P2P Music Platform: Technical Specification

> **Version:** 2.1  
> **Last Updated:** February 2026  
> **Status:** Technical Architecture Document

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Core Architecture](#3-core-architecture)
4. [Security & Encryption](#4-security--encryption)
5. [Social-Storage Model](#5-social-storage-model)
6. [Social Features](#6-social-features)
7. [Admin Dashboard](#7-admin-dashboard)
8. [Implementation Details](#8-implementation-details)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Compliance & Privacy](#10-compliance--privacy)
11. [Performance & Accessibility](#11-performance--accessibility)
12. [Implemented Features](#12-implemented-features)
13. [Development Roadmap](#13-development-roadmap)

---

## 1. Project Overview

A decentralized, peer-to-peer music streaming and social platform that eliminates central server dependencies through **WebTorrent** and **WebRTC** technologies. The platform employs a "Social-Directed Storage" model where users collectively host music content for artists they support.

### Key Objectives

- **Decentralization:** Eliminate single points of failure and reduce infrastructure costs
- **Privacy-First:** End-to-end encryption with user-controlled data sharing
- **Social Integration:** Music discovery through trusted social connections
- **Sustainability:** Distributed storage reduces environmental impact vs. centralized data centers

---

## 2. Technology Stack

### Frontend
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | **Next.js** | 15.x (latest) | Server-side rendering, static generation |
| UI Library | **React** | 19.x (latest) | Component-based UI architecture |
| Component System | **shadcn/ui** | latest | Accessible, customizable UI components |
| Styling | **Tailwind CSS** | 4.x (latest) | Utility-first CSS framework |
| State Management | **Zustand** | 5.x (latest) | Lightweight state management |
| Audio Processing | **Web Audio API** | Native | Real-time audio analysis and effects |

### P2P Infrastructure
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| P2P Engine | **WebTorrent** | 2.x (latest) | Browser-based BitTorrent client |
| Hybrid Client | **webtorrent-hybrid** | latest | Node.js and browser compatibility |
| Signaling | **Socket.io** | 4.x (latest) | Real-time peer coordination |
| NAT Traversal | **STUN/TURN (Coturn)** | 4.6.x (latest) | Firewall and NAT bypass |

### Backend & Database
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | **Node.js** | 23.x (Current) / 22.x (LTS) | Server-side JavaScript execution |
| API Framework | **Fastify** | 5.x (latest) | High-performance HTTP server |
| Primary Database | **PostgreSQL** | 17.x (latest) | Social graph and metadata storage |
| Cache Layer | **Redis** | 7.4.x (latest) | Session management and rate limiting |
| Search | **Meilisearch** | 1.12.x (latest) | Full-text search for tracks and artists |

### Security & Cryptography
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Encryption | **Web Crypto API** | Native | AES-256-GCM for content encryption |
| Key Exchange | **X25519 (ECDH)** | Native | Secure key agreement protocol |
| Authentication | **WebAuthn / Passkeys** | Level 3 (latest) | Passwordless authentication |
| Integrity | **BLAKE3** | 1.x (latest) | Fast cryptographic hashing |

---

## 3. Core Architecture

### 3.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Web App   │  │  Service    │  │    WebTorrent Client    │  │
│  │  (Next.js)  │  │  Worker     │  │   (Browser/Node.js)     │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────────┘  │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼ WebRTC / WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                      TRACKER LAYER                               │
│  ┌─────────────────┐  ┌────────────────────────────────────────┐ │
│  │ Private Tracker │  │      Social Graph Verification         │ │
│  │ (WebSocket)     │  │      (PostgreSQL Query Layer)          │ │
│  └─────────────────┘  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

1. **Upload Flow:** Artist encrypts track → Creates torrent → Shares magnet link with followers
2. **Discovery Flow:** User queries social graph → Receives authorized peer list → Establishes WebRTC connections
3. **Playback Flow:** Sequential piece selection → Decryption → Web Audio API streaming

---

## 4. Security & Encryption

### 4.1 Content Encryption

All audio files are encrypted client-side before distribution. Encryption keys are derived from social relationship data.

```javascript
/**
 * Encrypts audio content using AES-256-GCM
 * @param {ArrayBuffer} fileBuffer - Raw audio data
 * @param {CryptoKey} groupKey - Derived group encryption key
 * @returns {Promise<{encrypted: ArrayBuffer, iv: Uint8Array}>}
 */
async function encryptTrack(fileBuffer, groupKey) {
  // Generate cryptographically secure random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { 
      name: "AES-GCM", 
      iv,
      tagLength: 128 
    },
    groupKey,
    fileBuffer
  );
  
  return { encrypted, iv };
}

/**
 * Derives group key from social relationship
 * Uses X25519 key exchange for mutual follower relationships
 */
async function deriveGroupKey(userPrivateKey, peerPublicKey, salt) {
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: "X25519",
      public: peerPublicKey
    },
    userPrivateKey,
    256
  );
  
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt,
      info: new TextEncoder().encode("music-platform-v1")
    },
    await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
```

### 4.2 Key Management

| Aspect | Implementation |
|--------|----------------|
| Key Storage | IndexedDB with encrypted-at-rest |
| Key Rotation | Automatic every 30 days or on relationship change |
| Revocation | Immediate via tracker broadcast |
| Backup | Shamir's Secret Sharing for recovery |

---

## 5. Social-Storage Model

### 5.1 User Tiers & Roles

Data availability is maintained through a tiered participation model:

| Tier | Trigger | Storage | Persistence | Bandwidth |
|------|---------|---------|-------------|-----------|
| **Listener** | Play track | RAM | Session-only | Download only |
| **Liker** | Heart/like track | IndexedDB (500MB LRU) | 30 days | Limited upload |
| **Follower** | Follow artist | IndexedDB (2GB) | Persistent | Priority upload |
| **Super-Seeder** | Opt-in program | Local disk (configurable) | Indefinite | High bandwidth |

#### Universal Artist Status

**Every user on the platform is automatically considered an artist.** There is no separate artist registration or verification process required to upload music.

| Feature | Available To |
|---------|--------------|
| Upload tracks | All registered users (after onboarding) |
| Create albums | All registered users |
| Build follower base | All registered users |
| Receive likes/comments | All registered users |
| Analytics dashboard | All registered users |
| Monetization (future) | All registered users |

**Implications:**
- No distinction between "listener" and "artist" accounts
- Upload functionality is available after completing onboarding
- User profiles display both uploaded content and listening activity
- Social graph connections are bidirectional artist-to-artist relationships
- Discovery algorithms treat all users as potential content creators

```javascript
// User registration automatically enables artist capabilities
async function registerUser(userData) {
  // Check if this is one of the first 11 users (founder users)
  const userCount = await db.users.count();
  const isFounderUser = userCount < 11;
  
  const user = await db.users.create({
    ...userData,
    isArtist: true,  // Always true for all users
    canUpload: false, // Initially false until onboarding complete
    isFounderUser: isFounderUser,
    onboardingCompleted: isFounderUser, // Founders skip onboarding
    uploadQuota: {
      daily: 100 * 1024 * 1024,    // 100MB per day
      total: 10 * 1024 * 1024 * 1024 // 10GB total storage
    },
    artistProfile: {
      bio: '',
      genres: [],
      socialLinks: {},
      verified: false // Can be verified by platform for notable artists
    }
  });
  
  return user;
}
```

### 5.2 Onboarding Requirements

To ensure a vibrant social network and personalized experience, new users must complete onboarding before accessing full platform features.

#### Onboarding Flow

| Step | Requirement | Minimum Count | Purpose |
|------|-------------|---------------|---------|
| 1 | Select Music Preferences | 5 genres/artists/moods | Personalize discovery feed |
| 2 | Follow Users | 10 accounts | Bootstrap social graph connections |

**Founder Users Exception:**
The first 11 users to register are designated as "founder users" and are exempt from onboarding requirements. This allows early adopters to immediately begin uploading content and establishing the platform's initial content library.

```javascript
// Onboarding completion check
const ONBOARDING_REQUIREMENTS = {
  MIN_PREFERENCES: 5,
  MIN_FOLLOWS: 10,
  FOUNDER_USER_COUNT: 11
};

async function checkOnboardingStatus(userId) {
  const user = await db.users.findById(userId);
  
  // Founder users are automatically onboarded
  if (user.is_founder_user) {
    return { complete: true, reason: 'founder_user' };
  }
  
  const preferencesCount = await db.musicPreferences.count({
    where: { user_id: userId }
  });
  
  const followsCount = await db.follows.count({
    where: { follower_id: userId }
  });
  
  const isComplete = 
    preferencesCount >= ONBOARDING_REQUIREMENTS.MIN_PREFERENCES &&
    followsCount >= ONBOARDING_REQUIREMENTS.MIN_FOLLOWS;
  
  if (isComplete && !user.onboarding_completed) {
    // Mark onboarding as complete and enable upload
    await db.users.update(userId, {
      onboarding_completed: true,
      can_upload: true,
      music_preferences_selected: preferencesCount,
      users_followed_count: followsCount
    });
  }
  
  return {
    complete: isComplete,
    progress: {
      preferences: { current: preferencesCount, required: ONBOARDING_REQUIREMENTS.MIN_PREFERENCES },
      follows: { current: followsCount, required: ONBOARDING_REQUIREMENTS.MIN_FOLLOWS }
    }
  };
}

// Middleware to enforce onboarding
const requireOnboarding = async (req, res, next) => {
  const status = await checkOnboardingStatus(req.user.id);
  
  if (!status.complete) {
    return res.status(403).json({
      error: 'Onboarding incomplete',
      message: 'Please complete onboarding to access this feature',
      requirements: status.progress
    });
  }
  
  next();
};

// Protect upload endpoint
app.post('/api/v1/tracks', requireOnboarding, async (req, res) => {
  // Handle upload...
});
```

#### Music Preference Categories

Users can select preferences from the following categories (minimum 5 total across all categories):

| Category | Examples |
|----------|----------|
| **Genres** | Rock, Hip-Hop, Jazz, Electronic, Classical, Pop, R&B, Country, Metal, Folk |
| **Moods** | Energetic, Chill, Focus, Party, Workout, Sleep, Melancholic, Uplifting |
| **Eras** | 60s, 70s, 80s, 90s, 2000s, 2010s, 2020s, Classic, Modern |
| **Artists** | Specific artist names from platform database |

```javascript
// Save music preferences during onboarding
async function saveMusicPreferences(userId, preferences) {
  // preferences = [{ type: 'genre', value: 'Jazz' }, { type: 'mood', value: 'Chill' }, ...]
  
  const preferenceRecords = preferences.map(pref => ({
    user_id: userId,
    preference_type: pref.type,
    preference_value: pref.value
  }));
  
  await db.musicPreferences.bulkCreate(preferenceRecords);
  
  // Update user's preference count
  const count = await db.musicPreferences.count({ where: { user_id: userId } });
  await db.users.update(userId, { music_preferences_selected: count });
  
  // Check if onboarding is now complete
  await checkOnboardingStatus(userId);
  
  return { saved: preferences.length, total: count };
}
```

#### Suggested Users to Follow

During onboarding, users are presented with suggested accounts to follow:

```javascript
// Get suggested users for onboarding
async function getSuggestedUsers(userId) {
  // Get users with similar preferences
  const userPreferences = await db.musicPreferences.findAll({
    where: { user_id: userId }
  });
  
  const preferenceValues = userPreferences.map(p => p.preference_value);
  
  // Find users with overlapping preferences, excluding already followed
  const suggestions = await db.users.findAll({
    where: {
      id: { [Op.ne]: userId },
      '$preferences.preference_value$': { [Op.in]: preferenceValues }
    },
    include: [{
      model: db.musicPreferences,
      as: 'preferences',
      where: { preference_value: { [Op.in]: preferenceValues } }
    }],
    order: [
      [db.sequelize.fn('COUNT', db.sequelize.col('preferences.id')), 'DESC']
    ],
    group: ['users.id'],
    limit: 20
  });
  
  return suggestions;
}
```

### 5.2 Mutual-Only Gating

Access control is enforced at the tracker level through social graph verification:

```sql
-- Tracker peer authorization query
SELECT EXISTS (
  SELECT 1 FROM social_relationships 
  WHERE follower_id = :requester_id 
    AND following_id = :target_id
    AND relationship_type = 'mutual'
    AND status = 'active'
) AS is_authorized;
```

**Connection Flow:**
1. Peer A requests peer list for `InfoHash_X` from tracker
2. Tracker validates social relationship in database
3. If authorized, tracker returns encrypted peer endpoints
4. Peers establish WebRTC connection with DTLS encryption

### 5.3 User Trust Score (UTS)

A reputation system to prioritize high-quality peers:

| Factor | Weight | Description |
|--------|--------|-------------|
| Upload Ratio | 40% | Bytes uploaded / downloaded |
| Connection Stability | 25% | Average session duration |
| Content Integrity | 20% | Successful hash verification rate |
| Social Verification | 15% | Mutual connections count |

---

## 6. Implementation Details

### 6.1 P2P Audio Player

Implements sequential streaming for instant playback with adaptive buffering:

```javascript
import React, { useEffect, useState, useRef } from 'react';
import WebTorrent from 'webtorrent';

const P2PMusicPlayer = ({ magnetURI }) => {
  const [peerCount, setPeerCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const client = new WebTorrent({
      tracker: {
        ws: true,
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { 
              urls: 'turn:turn.example.com:3478',
              username: 'user',
              credential: 'pass'
            }
          ]
        }
      }
    });

    // Add the torrent to the client
    client.add(magnetURI, { sequential: true }, (torrent) => {
      // Update peer count in real-time
      torrent.on('wire', () => setPeerCount(torrent.numPeers));
      
      // Check if we're seeding
      setIsSeeding(torrent.done);

      // Find the audio file
      const file = torrent.files.find(f => 
        ['.mp3', '.ogg', '.m4a', '.flac'].some(ext => 
          f.name.toLowerCase().endsWith(ext)
        )
      );

      if (!file) {
        console.error('No audio file found in torrent');
        return;
      }

      // Stream directly to the <audio> element
      // 'sequential: true' is the secret sauce for instant playback
      file.renderTo(audioRef.current, {
        autoplay: false,
        controls: true
      });

      // Track download progress
      torrent.on('download', () => {
        setLoadingProgress(Math.round(torrent.progress * 100));
      });
    });

    // Cleanup on unmount
    return () => client.destroy();
  }, [magnetURI]);

  return (
    <div className="p2p-player-card">
      <audio ref={audioRef} className="w-full" controls />
      <div className="stats flex gap-4 text-sm">
        <span>Peers Hosting: {peerCount}</span>
        <span>Buffered: {loadingProgress}%</span>
        {isSeeding && <span className="text-green-400">⚡ Seeding</span>}
      </div>
    </div>
  );
};

export default P2PMusicPlayer;
```

### 6.2 Social Feed Component

```javascript
// FeedItem.js
import { useState } from 'react';
import P2PMusicPlayer from './P2PMusicPlayer';

const FeedItem = ({ post }) => {
  const [hasLiked, setHasLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleLike = async () => {
    const res = await fetch('/api/like', { 
      method: 'POST', 
      body: JSON.stringify({ postId: post.id }) 
    });
    const data = await res.json();
    
    setHasLiked(true);
    if (data.badge) {
      alert(`🏆 Achievement Unlocked: ${data.badge}!`);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(post.magnet_uri);
    alert('Magnet link copied to clipboard!');
  };

  return (
    <div className="music-post-card border rounded-lg p-4 mb-4">
      <div className="user-info flex items-center gap-2 mb-2">
        <img src={post.author.avatar} alt="avatar" className="w-8 h-8 rounded-full" />
        <p className="font-semibold">{post.author.username} uploaded a new track!</p>
      </div>

      <h3 className="text-lg font-bold mb-2">{post.title}</h3>

      {/* P2P Player */}
      <P2PMusicPlayer magnetURI={post.magnet_uri} />

      <div className="social-actions flex gap-4 mt-4">
        <button 
          onClick={handleLike}
          className={`btn ${hasLiked ? 'text-red-500' : 'text-gray-400'}`}
        >
          ❤️ {post.likes_count + (hasLiked ? 1 : 0)}
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="text-gray-400"
        >
          💬 {post.comments_count}
        </button>
        <button onClick={handleShare} className="text-gray-400">
          🔗 Share Magnet
        </button>
      </div>
    </div>
  );
};

export default FeedItem;
```

### 6.3 Like Button with Swarm Support

```javascript
const LikeButton = ({ post, isSeeding }) => {
  const [liked, setLiked] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  const handleLike = async () => {
    const res = await fetch('/api/like', { 
      method: 'POST', 
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
        className={`btn ${liked ? 'text-red-500' : 'text-gray-400'}`}
      >
        ❤️ {liked ? post.likes + 1 : post.likes}
      </button>

      {/* Gamification: Show the user they are helping host the music */}
      {isSeeding && liked && (
        <span className="text-xs text-green-400 animate-pulse">
          ⚡ You are actively supporting this swarm
        </span>
      )}
      
      {showBadge && (
        <div className="badge-notification bg-yellow-100 p-2 rounded mt-2">
          🏆 Achievement Unlocked: Swarm Supporter!
        </div>
      )}
    </div>
  );
};
```

### 6.4 Upload & Indexing Logic

The platform automatically extracts embedded metadata from uploaded audio files using the [`music-metadata`](https://www.npmjs.com/package/music-metadata) library. This eliminates the need for manual metadata input during upload.

**Supported Metadata Fields:**

| Field | Source | Fallback Value |
|-------|--------|----------------|
| `title` | ID3v2.4/TIT2, Vorbis COMMENT title, MP4 ©nam | Filename (without extension) |
| `artist` | ID3v2.4/TPE1, Vorbis COMMENT artist, MP4 ©ART | Uploading user's display name |
| `album` | ID3v2.4/TALB, Vorbis COMMENT album, MP4 ©alb | 'Unknown Album' |
| `albumArtist` | ID3v2.4/TPE2, Vorbis COMMENT albumartist | Same as `artist` |
| `genre` | ID3v2.4/TCON, Vorbis COMMENT genre | null |
| `year` | ID3v2.4/TYER/TDRC, Vorbis COMMENT date | null |
| `trackNumber` | ID3v2.4/TRCK, Vorbis COMMENT tracknumber | null |
| `duration` | Calculated from audio stream | 0 |
| `bitrate` | Calculated from audio stream | 0 |
| `coverArt` | ID3v2.4/APIC, Vorbis METADATA_BLOCK_PICTURE | null |

```javascript
const WebTorrent = require('webtorrent-hybrid');
const mm = require('music-metadata');
const path = require('path');
const client = new WebTorrent();

/**
 * Handles music upload with automatic metadata extraction
 * @param {string} filePath - Path to the audio file
 * @param {Object} db - Database connection
 * @param {Object} uploadingUser - User object of the uploader
 */
async function handleMusicUpload(filePath, db, uploadingUser) {
  try {
    // 1. Extract Embedded Metadata from the audio file
    const metadata = await mm.parseFile(filePath, {
      duration: true,        // Calculate duration
      skipCovers: false,     // Include cover art for extraction
      skipPostHeaders: true  // Optimization: don't read past metadata
    });

    const { common, format } = metadata;
    
    // 2. Derive track metadata with fallbacks
    const trackMetadata = {
      title: common.title || path.basename(filePath, path.extname(filePath)),
      artist: common.artist || uploadingUser.displayName || uploadingUser.username,
      album: common.album || 'Unknown Album',
      albumArtist: common.albumartist || common.artist || uploadingUser.displayName,
      genre: common.genre?.[0] || null,
      year: common.year || null,
      trackNumber: common.track?.no || null,
      duration: Math.round(format.duration || 0),
      bitrate: Math.round(format.bitrate || 0),
      sampleRate: format.sampleRate || null,
      format: format.container || path.extname(filePath).slice(1)
    };

    // 3. Extract and store cover art if present
    let coverArtUrl = null;
    if (common.picture && common.picture.length > 0) {
      const cover = common.picture[0]; // Use first image (usually front cover)
      coverArtUrl = await storeCoverArt(cover.data, cover.format);
    }

    // 4. Create the Torrent/Seed
    client.seed(filePath, { name: trackMetadata.title }, async (torrent) => {
      console.log('New track seeded! InfoHash:', torrent.infoHash);

      // 5. Prepare Database Object
      const trackData = {
        ...trackMetadata,
        magnet_uri: torrent.magnetURI,
        info_hash: torrent.infoHash,
        cover_art_url: coverArtUrl,
        uploaded_by: uploadingUser.id,
        uploaded_at: new Date().toISOString(),
        web_seed_url: `https://your-storage.com/music/${torrent.infoHash}.mp3`
      };

      // 6. Save to Database
      await db.collection('tracks').insertOne(trackData);
      
      console.log('Track successfully indexed and seeding:', trackMetadata.title);
      
      // 7. Return metadata to client for UI update
      return {
        success: true,
        track: trackData,
        extractedFrom: 'embedded_metadata',
        fieldsExtracted: Object.keys(trackMetadata)
      };
    });
  } catch (err) {
    console.error('Upload failed:', err.message);
    throw new Error(`Metadata extraction failed: ${err.message}`);
  }
}

/**
 * Stores cover art to persistent storage
 * @param {Buffer} imageData - Raw image buffer
 * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg')
 * @returns {Promise<string>} - URL to stored cover art
 */
async function storeCoverArt(imageData, mimeType) {
  // Implementation depends on storage backend (S3, local, etc.)
  // Returns URL to the stored image
  const hash = await crypto.subtle.digest('SHA-256', imageData);
  const hashHex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const extension = mimeType.split('/')[1] || 'jpg';
  const filename = `${hashHex}.${extension}`;
  
  // Store and return URL...
  return `/covers/${filename}`;
}
```

**Metadata Extraction Behavior:**

1. **Automatic Extraction:** No manual input required from users during upload
2. **Smart Fallbacks:** If metadata fields are missing, sensible defaults are applied
3. **Uploader Attribution:** Artist field defaults to the uploading user's name if no embedded artist is found
4. **Cover Art Support:** Album artwork is extracted and stored separately for quick loading
5. **Multiple Formats:** Supports MP3 (ID3), FLAC (Vorbis Comments), M4A (MP4 atoms), OGG, WAV, and more

**Client-Side Preview (Optional):**

```javascript
// Browser-side metadata preview before upload
async function previewMetadata(file) {
  const mm = await import('music-metadata-browser');
  const metadata = await mm.parseBlob(file);
  
  return {
    title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ''),
    artist: metadata.common.artist || 'Unknown Artist',
    album: metadata.common.album || 'Unknown Album',
    duration: metadata.format.duration,
    coverArt: metadata.common.picture?.[0]
  };
}
```

### 6.5 Private Tracker with Social Filter

```javascript
const { Server } = require('bittorrent-tracker');

const server = new Server({
  udp: false,   // Disable UDP (not supported by browsers)
  http: false,  // Disable standard HTTP
  ws: true,     // ENABLE WebSockets (Required for WebTorrent)
  stats: true,  // Provides a JSON summary of active swarms at /stats
  
  // Security: Only allow torrents from your own platform
  filter: function (infoHash, params, cb) {
    // Check your DB to see if the infoHash is valid
    const isAllowed = checkDatabase(infoHash); 
    cb(isAllowed ? null : new Error('Forbidden torrent'));
  }
});

// Expose admin endpoint for dashboard
server.on('listening', () => {
  app.get('/admin/swarm-health', (req, res) => {
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

server.on('error', (err) => console.log(`Tracker Error: ${err.message}`));
server.on('warning', (err) => console.log(`Tracker Warning: ${err.message}`));

const port = 8000;
server.listen(port, () => {
  console.log(`WebTorrent Tracker running at ws://localhost:${port}`);
});
```

### 6.6 Seed Box (Permanent Node)

```javascript
// Install: npm install webtorrent-hybrid
const WebTorrent = require('webtorrent-hybrid');
const client = new WebTorrent();

const filePath = './music/epic-track.mp3';

// Seed the file
client.seed(filePath, { name: 'Epic Track' }, (torrent) => {
  console.log('Client is seeding:', torrent.infoHash);
  console.log('Magnet URI:', torrent.magnetURI);
  
  // Save this torrent.magnetURI to your database 
  // so your Web App knows how to find this file.
});

// Handle errors so the server doesn't crash
client.on('error', (err) => {
  console.error('Error:', err.message);
});
```

### 6.7 P2P Audio Player Class

```javascript
import WebTorrent from 'webtorrent';

class P2PAudioPlayer {
  constructor() {
    this.client = new WebTorrent({
      tracker: {
        ws: true, // WebSocket trackers only
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { 
              urls: 'turn:turn.example.com:3478',
              username: 'user',
              credential: 'pass'
            }
          ]
        }
      }
    });
  }

  /**
   * Streams audio with sequential piece selection
   * @param {string} magnetURI - Magnet link with encryption key
   */
  async stream(magnetURI) {
    return new Promise((resolve, reject) => {
      this.client.add(magnetURI, { 
        sequential: true,
        strategy: 'rarest-first' // Fallback for non-sequential pieces
      }, (torrent) => {
        const audioFile = torrent.files.find(f => 
          ['.mp3', '.ogg', '.m4a', '.flac'].some(ext => 
            f.name.toLowerCase().endsWith(ext)
          )
        );
        
        if (!audioFile) {
          reject(new Error('No audio file found in torrent'));
          return;
        }

        // Create media source for streaming
        const mediaSource = new MediaSource();
        const audioElement = document.createElement('audio');
        audioElement.src = URL.createObjectURL(mediaSource);
        
        mediaSource.addEventListener('sourceopen', () => {
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          
          // Stream chunks as they arrive
          audioFile.createReadStream()
            .on('data', (chunk) => {
              if (!sourceBuffer.updating) {
                sourceBuffer.appendBuffer(chunk);
              }
            });
        });

        resolve({
          element: audioElement,
          torrent,
          file: audioFile
        });
      });
    });
  }
}
```

### 6.8 Service Worker for Background Seeding

```javascript
// sw.js - Service Worker for background torrent seeding
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Background sync for seeding
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-seed') {
    event.waitUntil(backgroundSeed());
  }
});

async function backgroundSeed() {
  const cache = await caches.open('torrent-cache-v1');
  const seedingList = await getSeedingListFromIndexedDB();
  
  for (const infoHash of seedingList) {
    const response = await cache.match(`/torrents/${infoHash}`);
    if (response) {
      // Continue seeding in background
      await notifyTrackerActive(infoHash);
    }
  }
}
```

### 6.9 Social Sync Worker

```javascript
// SocialSyncWorker.js - Handles social actions and adjusts P2P buffer
const handleSocialAction = async (action, data) => {
  switch(action) {
    case 'FOLLOW_ARTIST':
      // Proactively download 5MB of this artist's top tracks
      await swarmManager.preFetch(data.artistId, { depth: 'aggressive' });
      break;
    
    case 'LIKE_GENRE':
      // Join the genre swarm to help general network health
      await swarmManager.joinSwarm(`genre:${data.genreName}`, { quota: '50MB' });
      break;

    case 'UPDATE_PREFERENCES':
      // Clear old chunks that no longer match the user's taste
      await swarmManager.pruneCache(data.newPreferences);
      break;
  }
};
```

### 6.10 Proof of Storage Challenge

```javascript
// Triggered by the Tracker via WebSocket
async function proveStorage(challengeOffset, expectedHash, infoHash) {
  const db = await openIndexedDB();
  const chunk = await db.get('chunks', infoHash);

  if (!chunk) return false;

  // Read a specific slice of the encrypted data based on the challenge
  const slice = chunk.data.slice(challengeOffset, challengeOffset + 1024);
  const buffer = await slice.arrayBuffer();
  
  // Hash the slice
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Send hash back to Tracker to verify
  return hashHex === expectedHash;
}
```

### 6.11 Encrypt and Shard Function

```javascript
async function encryptAndShard(file) {
  // 1. Generate a high-security key (this stays in the Magnet Link)
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  // 2. Encrypt the entire file buffer
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    fileBuffer
  );

  // 3. Export the key to share in the Magnet Link
  const exportedKey = await window.crypto.subtle.exportKey("jwk", key);
  
  return {
    encryptedBlob: new Blob([encryptedBuffer]),
    keyString: btoa(JSON.stringify(exportedKey)),
    iv: btoa(String.fromCharCode(...iv))
  };
}
```

### 6.12 Persist to Device (IndexedDB)

```javascript
// Triggered by "Like" button
async function persistToDevice(torrent) {
  const dbRequest = indexedDB.open("SwarmCache", 1);

  dbRequest.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(["chunks"], "readwrite");
    const store = transaction.objectStore("chunks");

    torrent.files.forEach(file => {
      file.getBlob((err, blob) => {
        // Store the encrypted blob locally
        store.put({ infoHash: torrent.infoHash, data: blob });
        console.log("Chunk secured in user's persistent buffer.");
      });
    });
  };
}
```

### 6.13 Private Group Access

```javascript
// Example: Fetching a post for a private group
async function accessGroupPost(postId, groupId) {
  // 1. Check social permission via API
  const permission = await api.checkMembership(groupId);
  
  if (!permission.authorized) {
    throw new Error("You must be a member to join this swarm.");
  }

  // 2. Retrieve the Group's Decryption Key
  const secretKey = permission.groupKey;

  // 3. Join the swarm via the private tracker
  const torrent = client.add(magnetURI, {
    announce: [`wss://tracker.app.com?group=${groupId}&auth=${permission.token}`]
  });

  // 4. Decrypt on the fly using the group key
  renderDecryptedAudio(torrent, secretKey);
}
```

---

## 7. Deployment Architecture

### 7.1 Infrastructure Stack

The platform is designed to run on bare metal or virtual machines without containerization. Each component runs as a native service managed by systemd or a process manager like PM2.

#### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SERVER LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Next.js    │  │   Fastify    │  │  WebTorrent      │  │
│  │   (Port 3000)│  │   (Port 8080)│  │  Tracker         │  │
│  │              │  │              │  │  (Port 8000)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │     Coturn       │  │
│  │  (Port 5432) │  │  (Port 6379) │  │  (Port 3478)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Installation Steps

**1. PostgreSQL 17 (Latest)**
```bash
# Ubuntu/Debian - Add official PostgreSQL APT repository
sudo apt install curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > \
  /etc/apt/sources.list.d/pgdg.list'

sudo apt update
sudo apt install postgresql-17 postgresql-contrib-17
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE musicapp;"
sudo -u postgres psql -c "CREATE USER musicuser WITH PASSWORD 'securepassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE musicapp TO musicuser;"
```

**2. Redis 7.4 (Latest)**
```bash
# Ubuntu/Debian - Build from source for latest version
sudo apt install build-essential tcl
wget https://download.redis.io/redis-stable.tar.gz
tar xzf redis-stable.tar.gz
cd redis-stable
make
sudo make install

# Setup Redis as systemd service
sudo mkdir /etc/redis
sudo cp redis.conf /etc/redis/
sudo sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/dir \.\//dir \/var\/lib\/redis/' /etc/redis/redis.conf

# Create redis user and directories
sudo mkdir /var/lib/redis
sudo useradd -r -s /bin/false redis
sudo chown redis:redis /var/lib/redis
sudo chmod 770 /var/lib/redis

sudo systemctl enable redis
sudo systemctl start redis
```

**3. Node.js 23 (Current) or 22 (LTS)**
```bash
# Using NodeSource - Latest Current (23.x) or LTS (22.x)
# For Current (23.x):
curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
# For LTS (22.x):
# curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

sudo apt install -y nodejs

# Verify installation
node --version  # v23.x.x (Current) or v22.x.x (LTS)
npm --version   # 10.x.x or higher
```

**4. WebTorrent Tracker**
```bash
# Global installation
npm install -g bittorrent-tracker

# Create systemd service
sudo tee /etc/systemd/system/webtorrent-tracker.service > /dev/null <<EOF
[Unit]
Description=WebTorrent Tracker
After=network.target

[Service]
Type=simple
User=tracker
ExecStart=/usr/bin/bittorrent-tracker --ws --port 8000
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable webtorrent-tracker
sudo systemctl start webtorrent-tracker
```

**5. Coturn (TURN Server)**
```bash
sudo apt install coturn

# Configure /etc/turnserver.conf
sudo tee /etc/turnserver.conf > /dev/null <<EOF
listening-port=3478
fingerprint
lt-cred-mech
user=turnuser:turnpassword
realm=example.com
log-file=/var/log/turnserver.log
EOF

sudo systemctl enable coturn
sudo systemctl start coturn
```

### 7.2 Deployment Checklist

- [ ] **SSL/TLS:** Valid certificates for all endpoints (Let's Encrypt + Certbot)
- [ ] **Reverse Proxy:** Nginx configured with SSL termination
- [ ] **CORS:** Properly configured for cross-origin WebRTC
- [ ] **Rate Limiting:** Redis-based rate limiting on API and tracker
- [ ] **Monitoring:** Node Exporter + Prometheus + Grafana
- [ ] **Logging:** Structured logging with journald/rsyslog
- [ ] **Backup:** Automated PostgreSQL backups via pg_dump cron job
- [ ] **CDN:** Static assets served via Cloudflare or similar
- [ ] **Firewall:** UFW configured to allow only necessary ports
- [ ] **Updates:** Unattended security updates enabled

---

## 8. Compliance & Privacy

### 8.1 GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| Right to Access | Export all user data via API endpoint |
| Right to Erasure | Cryptographic deletion (key destruction) |
| Data Portability | Standardized export format (JSON) |
| Privacy by Design | End-to-end encryption by default |
| Consent Management | Granular permissions for data sharing |

### 8.2 DMCA & Content Policy

- **Content Hash Filtering:** Pre-known copyrighted content blocked at tracker
- **Report Mechanism:** Automated takedown via key revocation
- **Repeat Infringer Policy:** UTS score penalty for violations

---

## 9. Performance & Accessibility

### 9.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to First Byte (TTFB) | < 200ms | Web Vitals |
| First Contentful Paint (FCP) | < 1.0s | Lighthouse |
| Time to Interactive (TTI) | < 3.5s | Lighthouse |
| Audio Start Latency | < 500ms | Custom metric |
| P2P Connection Success | > 85% | Tracker metrics |

### 9.2 Accessibility Requirements

- **WCAG 2.2 Level AA** compliance
- Keyboard navigation for all controls
- Screen reader support with ARIA labels
- Reduced motion support for animations
- High contrast mode support

### 9.3 Progressive Enhancement

```javascript
// Feature detection for P2P capabilities
const supportsP2P = () => {
  return (
    'RTCPeerConnection' in window &&
    'WebSocket' in window &&
    'crypto' in window &&
    'subtle' in window.crypto
  );
};

// Fallback to centralized streaming if P2P unavailable
const initializePlayer = async () => {
  if (supportsP2P()) {
    return new P2PAudioPlayer();
  } else {
    console.warn('P2P not supported, using fallback');
    return new CentralizedAudioPlayer();
  }
};
```

---

## 10. Development Roadmap

### Phase 1: MVP (Months 1-3)
- [ ] Core WebTorrent integration
- [ ] Basic encryption/decryption
- [ ] Social graph database schema
- [ ] Simple player UI

### Phase 2: Beta (Months 4-6)
- [ ] Mobile-responsive design
- [ ] Service worker implementation
- [ ] UTS reputation system
- [ ] STUN/TURN server deployment

### Phase 3: Production (Months 7-9)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Accessibility compliance
- [ ] Documentation and API reference

### Phase 4: Scale (Months 10-12)
- [ ] Multi-region tracker deployment
- [ ] Advanced analytics
- [ ] Plugin/extension system
- [ ] Community governance features

---

## Appendix

### A. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/musicapp
REDIS_URL=redis://localhost:6379

# Security
ENCRYPTION_KEY_SALT=<random-32-byte-hex>
JWT_SECRET=<random-64-byte-hex>
WEBAUTHN_RP_ID=example.com

# P2P
TRACKER_URL=wss://tracker.example.com
STUN_SERVER=stun:stun.example.com:3478
TURN_SERVER=turn:turn.example.com:3478
TURN_USERNAME=username
TURN_PASSWORD=password

# Feature Flags
ENABLE_P2P=true
ENABLE_BACKGROUND_SEEDING=true
ENABLE_ANALYTICS=false
```

### B. Database Schema (PostgreSQL)

```sql
-- Users & Profiles
-- Note: All users are artists by default (is_artist = true)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  trust_score INT DEFAULT 0,
  badge TEXT DEFAULT 'Newbie',
  is_artist BOOLEAN DEFAULT TRUE,  -- All users are artists
  can_upload BOOLEAN DEFAULT TRUE, -- Upload permission granted by default
  daily_upload_quota BIGINT DEFAULT 104857600,    -- 100MB in bytes
  total_upload_quota BIGINT DEFAULT 10737418240,  -- 10GB in bytes
  role TEXT DEFAULT 'user',        -- 'user', 'moderator', 'superadmin'
  is_superadmin BOOLEAN DEFAULT FALSE,
  artist_bio TEXT,
  artist_genres TEXT[],
  artist_verified BOOLEAN DEFAULT FALSE,
  -- Onboarding requirements
  onboarding_completed BOOLEAN DEFAULT FALSE,
  music_preferences_selected INT DEFAULT 0,
  users_followed_count INT DEFAULT 0,
  is_founder_user BOOLEAN DEFAULT FALSE, -- First 11 users exempt from onboarding requirements
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Music Preferences (Genres, Artists, Moods)
CREATE TABLE music_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL, -- 'genre', 'artist', 'mood', 'era'
  preference_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, preference_type, preference_value)
);

-- Create the default superadmin user on initial setup
-- Password should be changed immediately after first login
INSERT INTO users (
  username, 
  email, 
  role, 
  is_superadmin, 
  badge,
  is_artist,
  can_upload,
  onboarding_completed,
  is_founder_user
) VALUES (
  'superadmin',
  'admin@platform.local',
  'superadmin',
  TRUE,
  'Platform Administrator',
  TRUE,
  TRUE,
  TRUE,
  TRUE
) ON CONFLICT (username) DO NOTHING;

-- Social Graph
CREATE TABLE follows (
  follower_id UUID REFERENCES users(id),
  following_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Music Posts (Torrents)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  magnet_uri TEXT NOT NULL,
  info_hash VARCHAR(40) UNIQUE,
  duration_seconds INT,
  bitrate INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Interactions
CREATE TABLE likes (
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  timestamp_seconds INT, -- For time-stamped comments
  created_at TIMESTAMP DEFAULT NOW()
);

-- Private Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  group_key TEXT, -- Encrypted group key for content
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id),
  user_id UUID REFERENCES users(id),
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Group Posts
CREATE TABLE group_posts (
  post_id UUID REFERENCES posts(id),
  group_id UUID REFERENCES groups(id),
  PRIMARY KEY (post_id, group_id)
);

-- Indexes for performance
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_likes_post ON likes(post_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
```

### C. User Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| **user** | Standard user/artist | Upload tracks, follow users, like content, comment |
| **moderator** | Content moderator | All user permissions + remove content, suspend users, view reports |
| **superadmin** | Platform administrator | All permissions + user management, system configuration, database access |

#### Superadmin Capabilities

The superadmin account has full platform control:

```javascript
// Superadmin middleware for protected routes
const requireSuperadmin = async (req, res, next) => {
  const user = await db.users.findById(req.user.id);
  
  if (!user.is_superadmin) {
    return res.status(403).json({ 
      error: 'Superadmin access required' 
    });
  }
  
  next();
};

// Superadmin-only endpoints
app.get('/api/v1/admin/users', requireSuperadmin, async (req, res) => {
  const users = await db.users.findAll({
    include: ['uploadStats', 'trustScore', 'reports']
  });
  res.json(users);
});

app.post('/api/v1/admin/users/:id/suspend', requireSuperadmin, async (req, res) => {
  await db.users.update(req.params.id, {
    suspended: true,
    suspended_at: new Date(),
    suspended_by: req.user.id
  });
  res.json({ success: true });
});

app.post('/api/v1/admin/system/config', requireSuperadmin, async (req, res) => {
  // Update platform-wide configuration
  await db.config.update(req.body);
  res.json({ success: true });
});
```

**Superadmin Setup:**
1. The default superadmin is created during database initialization
2. Username: `superadmin`
3. Email: `admin@platform.local`
4. **Important:** Change the default password immediately after first login
5. Additional superadmins can be promoted via the admin panel

### D. API Endpoints

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/api/v1/auth/register` | POST | User registration with WebAuthn | Public |
| `/api/v1/auth/login` | POST | Passwordless authentication | Public |
| `/api/v1/onboarding/status` | GET | Check onboarding completion status | Authenticated |
| `/api/v1/onboarding/preferences` | POST | Save music preferences (min 5) | Authenticated |
| `/api/v1/onboarding/suggested-users` | GET | Get suggested users to follow | Authenticated |
| `/api/v1/tracks` | GET | List tracks (with pagination) | Authenticated |
| `/api/v1/tracks` | POST | Upload new track | Authenticated + Onboarding |
| `/api/v1/tracks/:id` | GET | Get track metadata | Authenticated |
| `/api/v1/social/follow` | POST | Follow an artist | Authenticated |
| `/api/v1/social/unfollow` | POST | Unfollow an artist | Authenticated |
| `/api/v1/peers/:infoHash` | GET | Get authorized peers | Authenticated |
| `/api/v1/admin/users` | GET | List all users | Superadmin only |
| `/api/v1/admin/users/:id/suspend` | POST | Suspend a user | Superadmin/Moderator |
| `/api/v1/admin/system/config` | POST | Update system config | Superadmin only |

### C. Related Documentation

- [WebTorrent Documentation](https://webtorrent.io/docs)
- [WebRTC Specification](https://www.w3.org/TR/webrtc/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [WebAuthn Guide](https://webauthn.guide/)

---

## 12. Implemented Features

This section documents the features that have been implemented to align with the technical specification.

### 12.1 Mutual Relationship Gating

The platform now supports mutual-only content sharing through the `is_mutual` column in the `follows` table.

```sql
-- Mutual relationship trigger
CREATE OR REPLACE FUNCTION update_mutual_status()
RETURNS TRIGGER AS $
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
$ LANGUAGE plpgsql;
```

### 12.2 Proof of Storage Challenge

A new API endpoint has been added to verify that users are actually storing encrypted chunks.

**Endpoint:** `/api/storage-challenge`

| Method | Description |
|--------|-------------|
| POST | Verify storage challenge response |
| GET | Get current challenge for a user |

### 12.3 Swarm Health Visualization

The admin dashboard now includes a SwarmHealthChart component for visualizing peer distribution:

- **Guardians (High Trust):** UTS > 60
- **Nodes (Mutuals):** UTS 21-60
- **Listeners (Ephemeral):** UTS ≤ 20

### 12.4 Docker Compose Deployment

A complete Docker Compose configuration has been added for production deployment:

```bash
docker-compose up -d
```

This includes:
- PostgreSQL database
- Private Tracker service
- Coturn TURN server
- Next.js application
- Redis cache

### 12.5 Nginx Configuration

Production-ready nginx configuration with:
- SSL/TLS setup
- WebSocket proxy for tracker
- P2P connection timeouts
- Security headers

### 12.6 Coturn TURN Server

Complete TURN server configuration for NAT traversal:
- Long-term credentials
- SSL/TLS support
- Admin interface

### 12.7 Trigger-Based Distribution

The Service Worker now handles social actions:

- `FOLLOW_ARTIST`: Pre-fetches artist's top tracks
- `LIKE_GENRE`: Joins genre swarm
- `LIKE_TRACK`: Persists track to IndexedDB
- `UPDATE_PREFERENCES`: Clears old cache

### 12.8 Enhanced Admin Statistics

The admin stats API now includes:
- Swarm health metrics
- Trust score distribution
- Peer distribution
- Storage statistics

---

## 13. Development Roadmap

### Completed (v2.1)

- [x] Mutual relationship triggers
- [x] Proof of Storage Challenge API
- [x] Swarm Health Chart component
- [x] Docker Compose deployment
- [x] Nginx configuration
- [x] Coturn TURN server setup
- [x] Trigger-based distribution in Service Worker
- [x] Enhanced admin statistics

### In Progress

- [ ] X25519 key exchange for mutual authentication
- [ ] Geographic peer distribution visualization
- [ ] Mobile deep linking for PWA
- [ ] IPFS backup for artist metadata

### Future (v3.0)

- [ ] Governance voting system
- [ ] Token-based incentives
- [ ] Cross-platform mobile app
- [ ] Advanced analytics dashboard
- [ ] Artist monetization features

---

*Last Updated: February 2026*
*Version: 2.1**This document is maintained by the development team. For questions or updates, please open an issue in the project repository.*
