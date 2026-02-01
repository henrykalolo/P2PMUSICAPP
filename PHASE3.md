# Phase 3: Production Release - Implementation Plan

## Overview

Phase 3 transforms the P2P Music Platform from Beta to Production-ready status. This phase focuses on **performance optimization**, **security hardening**, **accessibility compliance**, **multi-region infrastructure**, and **mobile application development**.

**Version:** 3.0.0-production  
**Status:** Planning  
**Duration:** Months 7-9  
**Target Release:** Q2 2026

---

## Table of Contents

1. [Performance Optimization](#1-performance-optimization)
2. [Security Audit & Hardening](#2-security-audit--hardening)
3. [Accessibility Compliance (WCAG 2.2)](#3-accessibility-compliance-wcag-22)
4. [Multi-Region Tracker Deployment](#4-multi-region-tracker-deployment)
5. [Mobile Application (React Native)](#5-mobile-application-react-native)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Success Metrics](#7-success-metrics)

---

## 1. Performance Optimization

### 1.1 Smart Caching Strategy

Implement a multi-tier caching system to minimize redundant P2P downloads and improve playback latency.

```typescript
// src/lib/cache/TieredCache.ts
interface CacheTier {
  name: 'memory' | 'indexeddb' | 'service-worker';
  maxSize: number;
  ttl: number;
  priority: number;
}

class TieredCache {
  private tiers: CacheTier[] = [
    { name: 'memory', maxSize: 50 * 1024 * 1024, ttl: 300000, priority: 1 },    // 50MB, 5min
    { name: 'indexeddb', maxSize: 500 * 1024 * 1024, ttl: 86400000, priority: 2 }, // 500MB, 24h
    { name: 'service-worker', maxSize: 2000 * 1024 * 1024, ttl: 604800000, priority: 3 } // 2GB, 7d
  ];

  async getChunk(infoHash: string, pieceIndex: number): Promise<Uint8Array | null> {
    // Try memory first (fastest)
    const memChunk = await this.memoryCache.get(`${infoHash}:${pieceIndex}`);
    if (memChunk) return memChunk;

    // Fall through to IndexedDB
    const dbChunk = await this.indexedDBCache.get(`${infoHash}:${pieceIndex}`);
    if (dbChunk) {
      // Promote to memory cache
      await this.memoryCache.set(`${infoHash}:${pieceIndex}`, dbChunk);
      return dbChunk;
    }

    // Finally check Service Worker cache
    const swChunk = await this.serviceWorkerCache.get(`${infoHash}:${pieceIndex}`);
    if (swChunk) {
      // Promote up the chain
      await this.indexedDBCache.set(`${infoHash}:${pieceIndex}`, swChunk);
      await this.memoryCache.set(`${infoHash}:${pieceIndex}`, swChunk);
      return swChunk;
    }

    return null;
  }
}
```

### 1.2 Predictive Preloading

Use machine learning to predict which tracks users will play next and preload them intelligently.

```typescript
// src/lib/ml/PreloadPredictor.ts
interface PreloadPrediction {
  trackId: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  estimatedPlayTime: number; // seconds from now
}

class PreloadPredictor {
  private model: TFModel;

  async predictNextTracks(userContext: UserContext): Promise<PreloadPrediction[]> {
    const features = this.extractFeatures(userContext);
    const predictions = await this.model.predict(features);
    
    return predictions
      .filter(p => p.confidence > 0.6)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Preload top 3 most likely tracks
  }

  private extractFeatures(context: UserContext): Tensor {
    return tf.tensor([
      context.currentTrack?.genre === context.userPreferences.favoriteGenre ? 1 : 0,
      context.timeOfDay / 24, // Normalized hour
      context.dayOfWeek / 7,
      context.listeningHistory.length / 100, // Normalized
      context.socialConnections.filter(c => c.recentlyActive).length / 50,
      context.queuePosition / 10
    ]);
  }
}
```

### 1.3 Adaptive Bitrate Streaming

Implement DASH-style adaptive streaming for optimal quality based on network conditions.

```typescript
// src/lib/streaming/AdaptiveBitrate.ts
interface QualityLevel {
  bitrate: number;
  codec: string;
  label: string;
}

class AdaptiveBitrateController {
  private qualityLevels: QualityLevel[] = [
    { bitrate: 64000, codec: 'opus', label: 'Low' },
    { bitrate: 128000, codec: 'opus', label: 'Standard' },
    { bitrate: 256000, codec: 'opus', label: 'High' },
    { bitrate: 320000, codec: 'flac', label: 'Lossless' }
  ];

  private currentLevel = 1;
  private bandwidthEstimator: BandwidthEstimator;

  async selectOptimalQuality(): Promise<QualityLevel> {
    const estimatedBandwidth = this.bandwidthEstimator.getEstimate();
    const bufferHealth = this.getBufferHealth();
    
    // Select quality with headroom for network fluctuations
    const targetBitrate = estimatedBandwidth * 0.8;
    
    // Find highest quality that fits within bandwidth
    let selectedLevel = 0;
    for (let i = this.qualityLevels.length - 1; i >= 0; i--) {
      if (this.qualityLevels[i].bitrate <= targetBitrate) {
        selectedLevel = i;
        break;
      }
    }

    // Conservative approach if buffer is low
    if (bufferHealth < 10 && selectedLevel > 0) {
      selectedLevel--;
    }

    this.currentLevel = selectedLevel;
    return this.qualityLevels[selectedLevel];
  }
}
```

### 1.4 Web Worker Offloading

Move heavy cryptographic and P2P operations to Web Workers to prevent UI blocking.

```typescript
// src/workers/crypto.worker.ts
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'DECRYPT_CHUNK':
      const decrypted = await decryptChunk(
        payload.encryptedData,
        payload.key,
        payload.iv
      );
      self.postMessage({ type: 'DECRYPT_COMPLETE', result: decrypted });
      break;

    case 'VERIFY_HASH':
      const isValid = await verifyChunkHash(
        payload.chunkData,
        payload.expectedHash
      );
      self.postMessage({ type: 'VERIFY_COMPLETE', result: isValid });
      break;

    case 'DERIVE_KEY':
      const derivedKey = await deriveGroupKey(
        payload.sharedSecret,
        payload.salt
      );
      self.postMessage({ type: 'DERIVE_COMPLETE', result: derivedKey });
      break;
  }
});
```

### 1.5 Performance Targets

| Metric | Phase 2 (Current) | Phase 3 (Target) | Improvement |
|--------|-------------------|------------------|-------------|
| Time to First Byte (TTFB) | < 500ms | < 100ms | 80% faster |
| First Contentful Paint (FCP) | < 2.0s | < 0.8s | 60% faster |
| Time to Interactive (TTI) | < 4.0s | < 2.0s | 50% faster |
| Audio Start Latency | < 1000ms | < 300ms | 70% faster |
| P2P Connection Success | > 75% | > 90% | 20% improvement |
| Cache Hit Rate | ~40% | > 75% | 88% improvement |

---

## 2. Security Audit & Hardening

### 2.1 Comprehensive Security Audit

#### Automated Security Scanning

```yaml
# .github/workflows/security-audit.yml
name: Security Audit
on:
  push:
    branches: [main, production]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      
      - name: Run OWASP ZAP baseline scan
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: 'http://localhost:3000'
      
      - name: Run dependency review
        uses: actions/dependency-review-action@v3
```

#### Penetration Testing Checklist

- [ ] **WebRTC Security**: Verify ICE candidate privacy, STUN/TURN security
- [ ] **Cryptographic Implementation**: Audit AES-256-GCM, X25519 implementations
- [ ] **Magnet Link Security**: Ensure encryption keys cannot be extracted
- [ ] **Tracker Security**: DDoS protection, rate limiting validation
- [ ] **API Security**: Authentication bypass attempts, JWT validation
- [ ] **P2P Protocol**: Malicious peer handling, Sybil attack resistance
- [ ] **Storage Security**: IndexedDB encryption at rest
- [ ] **Content Security Policy**: XSS prevention, CSP headers

### 2.2 Enhanced Encryption

#### Post-Quantum Cryptography Preparation

```typescript
// src/lib/crypto/PostQuantumReady.ts
import { ML_KEM } from '@noble/post-quantum/ml-kem';

class QuantumResistantCrypto {
  // Hybrid classical + post-quantum key encapsulation
  async generateHybridKey(): Promise<HybridKeyPair> {
    // Classical X25519
    const classicalKeyPair = await window.crypto.subtle.generateKey(
      { name: 'X25519' },
      true,
      ['deriveBits']
    );

    // Post-quantum ML-KEM-768
    const pqKeyPair = await ML_KEM.keygen();

    return {
      classical: classicalKeyPair,
      postQuantum: pqKeyPair,
      hybridPublicKey: this.combinePublicKeys(
        classicalKeyPair.publicKey,
        pqKeyPair.publicKey
      )
    };
  }

  async hybridEncrypt(
    plaintext: Uint8Array,
    recipientHybridKey: HybridPublicKey
  ): Promise<HybridCiphertext> {
    // Encrypt with both schemes
    const classicalCiphertext = await this.encryptClassical(plaintext, recipientHybridKey.classical);
    const pqCiphertext = await ML_KEM.encapsulate(recipientHybridKey.postQuantum);
    
    // Combine ciphertexts
    return {
      classical: classicalCiphertext,
      postQuantum: pqCiphertext,
      combined: this.xorBytes(classicalCiphertext, pqCiphertext.sharedSecret)
    };
  }
}
```

#### Hardware Security Module (HSM) Integration

```typescript
// src/lib/crypto/HSMIntegration.ts
interface HSMConfig {
  provider: 'aws-cloudhsm' | 'azure-dedicated-hsm' | 'yubikey';
  keyId: string;
  region?: string;
}

class HSMKeyManager {
  private hsm: HSMProvider;

  async signWithHSM(data: Uint8Array, keyId: string): Promise<Uint8Array> {
    // Never expose private keys - all signing happens in HSM
    const signature = await this.hsm.sign({
      keyId,
      data,
      algorithm: 'ECDSA_SHA256'
    });
    
    return signature;
  }

  async rotateKeys(): Promise<void> {
    // Automated key rotation every 90 days
    const newKey = await this.hsm.generateKey({
      type: 'AES-256',
      extractable: false // Key never leaves HSM
    });

    // Re-encrypt all content with new key
    await this.reEncryptAllContent(newKey.id);
    
    // Schedule old key for deletion after grace period
    await this.scheduleKeyDeletion(this.currentKeyId, 30 * 24 * 60 * 60 * 1000);
  }
}
```

### 2.3 Threat Model & Mitigations

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Man-in-the-Middle (P2P) | Medium | High | DTLS 1.3 for all WebRTC connections |
| Sybil Attack | High | Medium | UTS reputation system + proof-of-storage |
| Eclipse Attack | Medium | High | DHT diversification, bootstrap node redundancy |
| Content Poisoning | Medium | High | Cryptographic verification + UTS penalties |
| DDoS on Tracker | High | High | Rate limiting, CDN protection, anycast |
| Key Extraction | Low | Critical | HSM storage, memory encryption |
| Metadata Leakage | Medium | Medium | Padding, dummy traffic, Tor integration |

### 2.4 Security Headers & CSP

```typescript
// next.config.js - Security headers
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data:;
      media-src 'self' blob:;
      connect-src 'self' wss: https:;
      worker-src 'self' blob:;
      child-src 'self' blob:;
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s+/g, ' ').trim()
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};
```

---

## 3. Accessibility Compliance (WCAG 2.2)

### 3.1 WCAG 2.2 Level AA Compliance

#### Keyboard Navigation

```tsx
// src/components/accessibility/KeyboardNavigation.tsx
import { useEffect, useRef } from 'react';

interface KeyboardNavProps {
  children: React.ReactNode;
  trapFocus?: boolean;
}

export const KeyboardNavigation: React.FC<KeyboardNavProps> = ({
  children,
  trapFocus = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (trapFocus) {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [trapFocus]);

  return <div ref={containerRef}>{children}</div>;
};
```

#### Screen Reader Support

```tsx
// src/components/player/AccessiblePlayer.tsx
export const AccessiblePlayer: React.FC<PlayerProps> = ({
  track,
  isPlaying,
  progress,
  onPlayPause,
  onSeek
}) => {
  const announce = useAnnouncer();

  useEffect(() => {
    if (isPlaying) {
      announce(`Now playing: ${track.title} by ${track.artist}`);
    }
  }, [isPlaying, track]);

  return (
    <div role="region" aria-label="Audio player">
      {/* Track info with proper heading hierarchy */}
      <h2 id="track-title">{track.title}</h2>
      <p id="track-artist" aria-label={`Artist: ${track.artist}`}>
        {track.artist}
      </p>

      {/* Play/Pause with descriptive label */}
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        aria-pressed={isPlaying}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Progress bar with ARIA */}
      <div
        role="slider"
        aria-label="Track progress"
        aria-valuemin={0}
        aria-valuemax={track.duration}
        aria-valuenow={progress}
        aria-valuetext={`${formatTime(progress)} of ${formatTime(track.duration)}`}
        tabIndex={0}
        onKeyDown={handleSliderKeyDown}
      >
        <div className="progress-bar" style={{ width: `${(progress / track.duration) * 100}%` }} />
      </div>

      {/* Live region for dynamic updates */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
};
```

#### High Contrast & Reduced Motion

```css
/* src/styles/accessibility.css */

/* High contrast mode support */
@media (prefers-contrast: high) {
  .player-controls {
    border: 2px solid currentColor;
  }

  .progress-bar {
    background: Canvas;
    border: 2px solid CanvasText;
  }

  .progress-bar-fill {
    background: Highlight;
  }

  button:focus-visible {
    outline: 3px solid Highlight;
    outline-offset: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .visualizer {
    display: none;
  }

  .equalizer-animation {
    animation: none;
  }
}

/* Focus visible for keyboard users */
:focus:not(:focus-visible) {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* Skip link for keyboard navigation */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--primary-color);
  color: white;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

### 3.2 Accessibility Testing

```typescript
// src/tests/accessibility/a11y.test.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('homepage should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('player controls should be keyboard accessible', async ({ page }) => {
    await page.goto('/player');
    
    // Tab through all controls
    const controls = ['play-button', 'volume-slider', 'progress-bar', 'next-button'];
    
    for (const controlId of controls) {
      await page.keyboard.press('Tab');
      const isFocused = await page.evaluate(
        (id) => document.getElementById(id) === document.activeElement,
        controlId
      );
      expect(isFocused).toBe(true);
    }
  });

  test('screen reader should announce track changes', async ({ page }) => {
    await page.goto('/player');
    
    const liveRegion = page.locator('[aria-live="polite"]');
    
    // Play a track
    await page.click('[data-testid="play-button"]');
    
    // Check that live region was updated
    await expect(liveRegion).toContainText('Now playing');
  });
});
```

### 3.3 Accessibility Checklist

- [ ] **1.1 Text Alternatives**: All non-text content has text alternatives
- [ ] **1.2 Time-based Media**: Audio descriptions, captions for video
- [ ] **1.3 Adaptable**: Content can be presented in different ways
- [ ] **1.4 Distinguishable**: Color not sole means of conveying information
- [ ] **2.1 Keyboard Accessible**: All functionality available via keyboard
- [ ] **2.2 Enough Time**: Users have enough time to read and use content
- [ ] **2.3 Seizures**: No content that causes seizures
- [ ] **2.4 Navigable**: Ways to navigate and find content
- [ ] **2.5 Input Modalities**: Easier input methods beyond keyboard
- [ ] **3.1 Readable**: Text content readable and understandable
- [ ] **3.2 Predictable**: Interface appears and operates predictably
- [ ] **3.3 Input Assistance**: Help users avoid and correct mistakes
- [ ] **4.1 Compatible**: Compatible with current and future assistive tech

---

## 4. Multi-Region Tracker Deployment

### 4.1 Global Tracker Infrastructure

```yaml
# infrastructure/terraform/trackers.tf
# Multi-region tracker deployment

variable "regions" {
  default = ["us-east-1", "eu-west-1", "ap-southeast-1", "sa-east-1"]
}

resource "aws_instance" "tracker" {
  for_each = toset(var.regions)
  
  ami           = data.aws_ami.ubuntu.id
  instance_type = "c6i.xlarge" # Compute optimized
  
  user_data = templatefile("${path.module}/tracker-setup.sh", {
    region = each.value
    tracker_port = 8000
  })

  tags = {
    Name = "webtorrent-tracker-${each.value}"
    Region = each.value
  }
}

# Anycast IP for global load balancing
resource "aws_globalaccelerator_accelerator" "tracker_anycast" {
  name = "tracker-anycast"
  
  ip_address_type = "DUAL_STACK"
  enabled = true
}

resource "aws_globalaccelerator_endpoint_group" "tracker_endpoints" {
  for_each = toset(var.regions)
  
  listener_arn = aws_globalaccelerator_listener.tracker.arn
  endpoint_group_region = each.value
  
  health_check_protocol = "TCP"
  health_check_port = 8000
  
  traffic_dial_percentage = 100
  
  endpoint_configuration {
    endpoint_id = aws_instance.tracker[each.value].id
    weight = 100
    client_ip_preservation_enabled = true
  }
}
```

### 4.2 Tracker Synchronization

```typescript
// src/lib/tracker/TrackerCluster.ts
interface TrackerNode {
  id: string;
  region: string;
  endpoint: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  load: number;
  peerCount: number;
}

class TrackerCluster {
  private nodes: Map<string, TrackerNode> = new Map();
  private gossipInterval = 5000; // 5 seconds

  async initialize(): Promise<void> {
    // Discover all tracker nodes
    await this.discoverNodes();
    
    // Start gossip protocol
    this.startGossipProtocol();
    
    // Start health checks
    this.startHealthChecks();
  }

  private startGossipProtocol(): void {
    setInterval(async () => {
      // Share peer lists with other trackers
      for (const [nodeId, node] of this.nodes) {
        if (node.health === 'healthy') {
          await this.gossipWithNode(node);
        }
      }
    }, this.gossipInterval);
  }

  async gossipWithNode(node: TrackerNode): Promise<void> {
    const localSwarms = await this.getLocalSwarmSummary();
    
    const response = await fetch(`${node.endpoint}/gossip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: this.nodeId,
        swarms: localSwarms,
        timestamp: Date.now()
      })
    });

    if (response.ok) {
      const remoteData = await response.json();
      await this.mergeSwarmData(remoteData.swarms);
    }
  }

  getOptimalTracker(userRegion: string): TrackerNode {
    // Find closest healthy tracker
    const healthyNodes = Array.from(this.nodes.values())
      .filter(n => n.health === 'healthy')
      .sort((a, b) => {
        // Sort by region proximity, then by load
        const aProximity = this.getRegionProximity(userRegion, a.region);
        const bProximity = this.getRegionProximity(userRegion, b.region);
        
        if (aProximity !== bProximity) {
          return aProximity - bProximity;
        }
        
        return a.load - b.load;
      });

    return healthyNodes[0];
  }
}
```

### 4.3 Geo-Distributed Seeding

```typescript
// src/lib/p2p/GeoSeeding.ts
interface GeoSeedingStrategy {
  region: string;
  seedRatio: number;
  priorityTracks: string[];
}

class GeoDistributedSeeding {
  private strategies: Map<string, GeoSeedingStrategy> = new Map([
    ['us-east-1', { region: 'us-east-1', seedRatio: 1.5, priorityTracks: [] }],
    ['eu-west-1', { region: 'eu-west-1', seedRatio: 1.5, priorityTracks: [] }],
    ['ap-southeast-1', { region: 'ap-southeast-1', seedRatio: 1.5, priorityTracks: [] }]
  ]);

  async optimizeRegionalSeeding(): Promise<void> {
    for (const [region, strategy] of this.strategies) {
      // Analyze popular tracks in this region
      const popularTracks = await this.analyzeRegionalPopularity(region);
      
      // Ensure minimum seeders for popular content
      for (const track of popularTracks) {
        const currentSeeders = await this.getRegionalSeederCount(track.id, region);
        const targetSeeders = Math.ceil(track.playCount * 0.01); // 1% of plays
        
        if (currentSeeders < targetSeeders) {
          await this.deploySeedBox(track, region, targetSeeders - currentSeeders);
        }
      }
    }
  }

  private async analyzeRegionalPopularity(region: string): Promise<Track[]> {
    // Query analytics for region-specific popularity
    return await db.query(`
      SELECT t.*, COUNT(*) as play_count
      FROM plays p
      JOIN posts t ON p.track_id = t.id
      WHERE p.region = $1
        AND p.played_at > NOW() - INTERVAL '7 days'
      GROUP BY t.id
      ORDER BY play_count DESC
      LIMIT 100
    `, [region]);
  }
}
```

### 4.4 Regional Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GLOBAL LOAD BALANCER                                 │
│                    (Anycast IP - Route 53 / CloudFlare)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   US-East Tracker   │◄──►│   EU-West Tracker   │◄──►│  APAC Tracker       │
│   (Virginia)        │    │   (Ireland)         │    │  (Singapore)        │
│                     │    │                     │    │                     │
│  • WebSocket Port   │    │  • WebSocket Port   │    │  • WebSocket Port   │
│  • Gossip Protocol  │    │  • Gossip Protocol  │    │  • Gossip Protocol  │
│  • Regional Cache   │    │  • Regional Cache   │    │  • Regional Cache   │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   US Seed Boxes     │    │   EU Seed Boxes     │    │  APAC Seed Boxes    │
│   (3x c6i.large)    │    │   (3x c6i.large)    │    │  (2x c6i.large)     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

---

## 5. Mobile Application (React Native)

### 5.1 React Native Architecture

```typescript
// mobile/src/core/P2PBridge.ts
// Bridge between React Native and native WebTorrent implementation

import { NativeModules, NativeEventEmitter } from 'react-native';

const { WebTorrentModule } = NativeModules;
const webTorrentEvents = new NativeEventEmitter(WebTorrentModule);

interface TorrentInfo {
  infoHash: string;
  magnetURI: string;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
}

class P2PBridge {
  async initialize(): Promise<void> {
    await WebTorrentModule.initialize({
      maxConnections: 55,
      downloadLimit: -1, // Unlimited
      uploadLimit: -1,
      dht: true,
      tracker: true
    });
  }

  async addTorrent(magnetURI: string, options: TorrentOptions): Promise<TorrentInfo> {
    return await WebTorrentModule.addTorrent(magnetURI, {
      ...options,
      // Mobile-specific optimizations
      maxBufferLength: 10 * 1024 * 1024, // 10MB buffer
      store: 'memory' // Use memory store for better performance
    });
  }

  on(event: string, callback: (data: any) => void): void {
    webTorrentEvents.addListener(event, callback);
  }

  // Background download support
  async enableBackgroundDownloads(): Promise<void> {
    await WebTorrentModule.enableBackgroundMode({
      notificationTitle: 'P2P Music Downloading',
      notificationBody: 'Downloading tracks in background'
    });
  }
}
```

### 5.2 Native Module Implementation (iOS)

```swift
// mobile/ios/WebTorrentModule.swift
import Foundation
import React
import WebTorrent

@objc(WebTorrentModule)
class WebTorrentModule: RCTEventEmitter {
  private var client: WebTorrentClient?
  private var hasListeners = false
  
  @objc
  func initialize(_ config: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        self.client = try WebTorrentClient(config: config as! [String: Any])
        resolver(["status": "initialized"])
      } catch {
        rejecter("INIT_ERROR", error.localizedDescription, error)
      }
    }
  }
  
  @objc
  func addTorrent(_ magnetURI: String, options: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let client = self.client else {
      rejecter("NOT_INITIALIZED", "WebTorrent client not initialized", nil)
      return
    }
    
    client.add(magnetURI, options: options as! [String: Any]) { torrent in
      // Emit progress updates
      torrent.on("download") { _ in
        if self.hasListeners {
          self.sendEvent(withName: "torrentProgress", body: [
            "infoHash": torrent.infoHash,
            "progress": torrent.progress,
            "downloadSpeed": torrent.downloadSpeed,
            "uploadSpeed": torrent.uploadSpeed,
            "numPeers": torrent.numPeers
          ])
        }
      }
      
      resolver([
        "infoHash": torrent.infoHash,
        "magnetURI": torrent.magnetURI
      ])
    }
  }
  
  @objc
  func enableBackgroundMode(_ config: NSDictionary) {
    // Configure background task for continued seeding
    BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.p2pmusic.backgroundSeed", using: nil) { task in
      self.handleBackgroundSeed(task: task as! BGAppRefreshTask)
    }
  }
  
  override func supportedEvents() -> [String]! {
    return ["torrentProgress", "torrentDone", "torrentError", "peerConnect", "peerDisconnect"]
  }
  
  override func startObserving() {
    hasListeners = true
  }
  
  override func stopObserving() {
    hasListeners = false
  }
}
```

### 5.3 Native Module Implementation (Android)

```kotlin
// mobile/android/app/src/main/java/com/p2pmusic/WebTorrentModule.kt
package com.p2pmusic

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import libtorrent.LibTorrent
import libtorrent.Session

class WebTorrentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private var session: Session? = null
  
  override fun getName() = "WebTorrentModule"
  
  @ReactMethod
  fun initialize(config: ReadableMap, promise: Promise) {
    try {
      session = LibTorrent.createSession(
        maxConnections = config.getInt("maxConnections"),
        downloadLimit = config.getInt("downloadLimit"),
        uploadLimit = config.getInt("uploadLimit")
      )
      promise.resolve(mapOf("status" to "initialized"))
    } catch (e: Exception) {
      promise.reject("INIT_ERROR", e.message)
    }
  }
  
  @ReactMethod
  fun addTorrent(magnetURI: String, options: ReadableMap, promise: Promise) {
    session?.let { sess ->
      val torrent = sess.addTorrent(magnetURI)
      
      // Set up progress listener
      torrent.setProgressListener { progress, downloadSpeed, uploadSpeed, numPeers ->
        val params = Arguments.createMap().apply {
          putString("infoHash", torrent.infoHash())
          putDouble("progress", progress)
          putDouble("downloadSpeed", downloadSpeed.toDouble())
          putDouble("uploadSpeed", uploadSpeed.toDouble())
          putInt("numPeers", numPeers)
        }
        
        reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("torrentProgress", params)
      }
      
      promise.resolve(mapOf(
        "infoHash" to torrent.infoHash(),
        "magnetURI" to torrent.magnetURI()
      ))
    } ?: promise.reject("NOT_INITIALIZED", "Session not initialized")
  }
  
  @ReactMethod
  fun enableBackgroundMode(config: ReadableMap) {
    val workRequest = PeriodicWorkRequestBuilder<SeedingWorker>(15, TimeUnit.MINUTES)
      .setInputData(workDataOf(
        "notificationTitle" to config.getString("notificationTitle"),
        "notificationBody" to config.getString("notificationBody")
      ))
      .build()
    
    WorkManager.getInstance(reactApplicationContext)
      .enqueueUniquePeriodicWork(
        "backgroundSeeding",
        ExistingPeriodicWorkPolicy.KEEP,
        workRequest
      )
  }
}
```

### 5.4 Mobile UI Components

```tsx
// mobile/src/components/MobilePlayer.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions
} from 'react-native';
import { Text, Slider } from '@rneui/themed';
import TrackPlayer, { State, Event } from 'react-native-track-player';
import { P2PBridge } from '../core/P2PBridge';

const { height } = Dimensions.get('window');

export const MobilePlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [peers, setPeers] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const translateY = useState(new Animated.Value(0))[0];

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 10;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        translateY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 100) {
        // Close player
        Animated.spring(translateY, {
          toValue: height,
          useNativeDriver: true
        }).start();
      } else {
        // Snap back
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true
        }).start();
      }
    }
  });

  useEffect(() => {
    // Subscribe to P2P events
    const bridge = new P2PBridge();
    
    bridge.on('torrentProgress', (data) => {
      setProgress(data.progress);
      setPeers(data.numPeers);
      setDownloadSpeed(data.downloadSpeed);
    });

    return () => {
      // Cleanup
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }] }
      ]}
      {...panResponder.panHandlers}
    >
      {/* Album Art */}
      <View style={styles.artworkContainer}>
        <Animated.Image
          source={{ uri: currentTrack?.artwork }}
          style={styles.artwork}
        />
      </View>

      {/* Track Info */}
      <View style={styles.infoContainer}>
        <Text h4 numberOfLines={1}>{currentTrack?.title}</Text>
        <Text style={styles.artist}>{currentTrack?.artist}</Text>
      </View>

      {/* P2P Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          ⚡ {peers} peers • {(downloadSpeed / 1024).toFixed(1)} KB/s
        </Text>
      </View>

      {/* Progress Bar */}
      <Slider
        value={progress}
        onValueChange={handleSeek}
        maximumTrackTintColor="#d3d3d3"
        minimumTrackTintColor="#1db954"
        thumbTintColor="#1db954"
      />

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={handlePrevious}>
          <Icon name="skip-previous" size={40} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
          <Icon
            name={isPlaying ? 'pause-circle-filled' : 'play-circle-filled'}
            size={70}
            color="#1db954"
          />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleNext}>
          <Icon name="skip-next" size={40} />
        </TouchableOpacity>
      </View>

      {/* Offline Badge */}
      {isOffline && (
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineText}>Offline Mode</Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20
  },
  artworkContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  artwork: {
    width: 300,
    height: 300,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20
  },
  infoContainer: {
    alignItems: 'center',
    marginVertical: 20
  },
  artist: {
    color: '#b3b3b3',
    fontSize: 16,
    marginTop: 5
  },
  statsContainer: {
    alignItems: 'center',
    marginBottom: 10
  },
  statsText: {
    color: '#1db954',
    fontSize: 12
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20
  },
  playButton: {
    marginHorizontal: 30
  },
  offlineBadge: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#1db954',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  }
});
```

### 5.5 Mobile Features

| Feature | iOS | Android | Description |
|---------|-----|---------|-------------|
| Background Audio | ✅ | ✅ | Continue playback when app is backgrounded |
| Background Seeding | ✅ | ✅ | Seed torrents via background tasks |
| Offline Downloads | ✅ | ✅ | Download tracks for offline listening |
| CarPlay | ✅ | ❌ | Native CarPlay integration |
| Android Auto | ❌ | ✅ | Android Auto support |
| AirPlay | ✅ | ❌ | Stream to AirPlay devices |
| Chromecast | ✅ | ✅ | Cast to Chromecast devices |
| Widgets | ✅ | ✅ | Home screen widgets for quick access |
| Push Notifications | ✅ | ✅ | New uploads from followed artists |

---

## 6. Implementation Roadmap

### Sprint 1: Performance Foundation (Weeks 1-3)

**Goals:**
- Implement tiered caching system
- Set up Web Workers for crypto operations
- Deploy performance monitoring

**Deliverables:**
- [ ] [`TieredCache`](src/lib/cache/TieredCache.ts) implementation
- [ ] Web Worker infrastructure
- [ ] Performance metrics dashboard

### Sprint 2: Security Hardening (Weeks 4-6)

**Goals:**
- Complete security audit
- Implement automated security scanning
- Deploy CSP and security headers

**Deliverables:**
- [ ] Security audit report
- [ ] GitHub Actions security workflow
- [ ] HSM integration (if applicable)
- [ ] Security documentation

### Sprint 3: Accessibility (Weeks 7-9)

**Goals:**
- WCAG 2.2 Level AA compliance
- Screen reader optimization
- Keyboard navigation

**Deliverables:**
- [ ] Accessibility audit report
- [ ] [`AccessiblePlayer`](src/components/player/AccessiblePlayer.tsx) component
- [ ] ARIA labels throughout app
- [ ] Accessibility testing suite

### Sprint 4: Multi-Region Infrastructure (Weeks 10-12)

**Goals:**
- Deploy trackers in 4 regions
- Implement gossip protocol
- Set up geo-distributed seeding

**Deliverables:**
- [ ] Terraform infrastructure code
- [ ] [`TrackerCluster`](src/lib/tracker/TrackerCluster.ts) implementation
- [ ] Regional seed box deployment
- [ ] Global load balancer configuration

### Sprint 5: Mobile App - Core (Weeks 13-15)

**Goals:**
- React Native project setup
- Native module bridges
- Basic player functionality

**Deliverables:**
- [ ] iOS native module
- [ ] Android native module
- [ ] Mobile player UI
- [ ] P2P bridge implementation

### Sprint 6: Mobile App - Polish (Weeks 16-18)

**Goals:**
- Background modes
- Offline support
- Platform-specific features

**Deliverables:**
- [ ] Background audio support
- [ ] Offline download manager
- [ ] Push notifications
- [ ] App store submissions

### Sprint 7: Integration & Testing (Weeks 19-21)

**Goals:**
- End-to-end testing
- Load testing
- Bug fixes and optimization

**Deliverables:**
- [ ] E2E test suite
- [ ] Load test results
- [ ] Performance benchmarks
- [ ] Bug fix sprint

### Sprint 8: Launch Preparation (Weeks 22-24)

**Goals:**
- Documentation
- Marketing materials
- Production deployment

**Deliverables:**
- [ ] API documentation
- [ ] User guides
- [ ] Production deployment
- [ ] Launch announcement

---

## 7. Success Metrics

### Performance KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Audio Start Latency | < 300ms | 95th percentile |
| Cache Hit Rate | > 75% | Average across users |
| P2P Connection Success | > 90% | Per session |
| App Load Time | < 2s | Time to Interactive |
| Battery Impact (Mobile) | < 5%/hour | Background seeding |

### Security KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Vulnerabilities (Critical) | 0 | Weekly scan |
| Vulnerabilities (High) | < 3 | Weekly scan |
| Penetration Test Findings | 0 Critical | Quarterly |
| Key Compromise Incidents | 0 | Per quarter |

### Accessibility KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| WCAG Compliance | 2.2 AA | Automated + manual |
| Keyboard Navigation | 100% | All features |
| Screen Reader Support | 100% | Core flows |
| Color Contrast | 100% | All UI elements |

### Business KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mobile App Downloads | 10,000 | First month |
| Daily Active Users | 5,000 | Post-launch |
| Average Session Duration | > 15 min | Per user |
| User Retention (D30) | > 40% | Monthly cohort |
| P2P Data Ratio | > 70% | P2P vs centralized |

---

## Appendix

### A. Environment Variables (New)

```bash
# Multi-region tracker configuration
TRACKER_REGIONS=us-east-1,eu-west-1,ap-southeast-1,sa-east-1
TRACKER_ANYCAST_IP=xxx.xxx.xxx.xxx

# HSM Configuration (optional)
HSM_PROVIDER=aws-cloudhsm
HSM_KEY_ID=alias/p2p-music-master

# Mobile app configuration
MOBILE_APP_BUNDLE_ID=com.p2pmusic.app
MOBILE_PUSH_CERT_PATH=/path/to/cert.p12

# Performance tuning
CACHE_MEMORY_SIZE=52428800
CACHE_INDEXEDDB_SIZE=524288000
MAX_WEB_WORKERS=4
```

### B. New Dependencies

```json
{
  "dependencies": {
    "@tensorflow/tfjs": "^4.x",
    "@noble/post-quantum": "^1.x",
    "react-native-track-player": "^4.x",
    "react-native-background-fetch": "^4.x",
    "@axe-core/playwright": "^4.x"
  }
}
```

### C. Related Documentation

- [Phase 2 Summary](./PHASE2.md)
- [Technical Specification](./Documentation.md)
- [WebTorrent Documentation](https://webtorrent.io/docs)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/Understanding/)
- [React Native Docs](https://reactnative.dev/)

---

**Version:** 3.0.0-production  
**Last Updated:** January 2026  
**Status:** Planning Phase  
**Next Review:** February 2026
