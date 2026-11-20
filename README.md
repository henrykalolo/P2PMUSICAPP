# P2P Music Platform

A music streaming app with a social graph. The current architecture is **server-authoritative with optional P2P/IPFS acceleration**: PostgreSQL is the source of truth, Media bytes are stored on the server (encrypted at rest), and playback always works without any peer or tracker. P2P transports are additive, never required.

## What actually works

- Email/password auth (JWT), WebAuthn credential tables, onboarding, profiles
- Track upload with per-user quotas, server-side encryption at rest, instant availability
- Range-capable audio streaming with short-lived signed URLs (seeking works)
- Social features: follows, likes, comments, reposts, playlists, notifications
- Discovery feed, artist pages, admin area, trust-score scaffolding
- IPFS helpers for optional secondary storage

## Architecture

1. **PostgreSQL** — all metadata and relationships (`src/lib/db/schema.sql`)
2. **Storage** — files written under `STORAGE_DIR`, encrypted per 1 MiB chunk with AES-256-GCM; IV and plaintext size kept in a sidecar file
3. **Playback** — `/api/media/token` issues a 1-hour scoped token; `/api/media/:trackId` validates it, resolves the file, decrypts only the requested chunks, and returns HTTP 206 responses for range requests
4. **P2P/IPFS** — optional. A track may be mirrored to IPFS when server quota is exceeded; the media route redirects to the gateway only when no server copy exists

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details and tradeoffs.

## Stack

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS 4, Lucide icons, Zustand
- PostgreSQL via `pg`, JWT via `jose`, bcrypt for passwords
- Node crypto for encryption at rest; Helia for optional IPFS

Helia/IPFS libraries remain available for optional secondary storage, but playback always works from the server copy. WebTorrent was removed because it was never wired into upload or playback.

## Getting started

Requirements: Node.js 20+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_MASTER_KEY
npm run db:setup
npm run dev
```

Create an administrator with:

```bash
ADMIN_PASSWORD='a-strong-password' npm run db:seed-admin
```

Open http://localhost:3000.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run db:setup` | Apply the canonical schema (idempotent) |
| `npm run db:seed-admin` | Create/update the superadmin |

## Configuration notes

- `JWT_SECRET` and `ENCRYPTION_MASTER_KEY` are **required** and must be 64 hex characters each (`openssl rand -hex 32`). The app fails fast rather than using insecure defaults.
- Losing `ENCRYPTION_MASTER_KEY` makes stored audio unrecoverable. Back it up securely.
- `STORAGE_DIR` defaults to `./uploads`; mount persistent storage there in production.
- `ENABLE_P2P_MIGRATION` is **off by default**. Leaving it off keeps IPFS as a fallback only and prevents background jobs from moving server-authoritative files.

## Documentation status

`TECHNICAL_SPECIFICATION.md`, `PHASE2.md`, `PHASE3.md`, and `PHASE4.md` are historical planning documents. They describe aspirational features (private swarms, token economy, edge autoscaling) that are **not** part of the running application. [ARCHITECTURE.md](./ARCHITECTURE.md) is the authoritative description of the implemented system.
