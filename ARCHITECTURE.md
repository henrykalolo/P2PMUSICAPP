# Architecture (implemented system)

## Decision: server-authoritative hybrid

The previous design claimed a P2P-first network, but uploads and playback depended on central storage and the P2P clients were not wired into the product. This project now uses a **server-authoritative hybrid**:

- Correctness, authorization, and availability come from the server.
- Content bytes live in a configurable local/object-store path, encrypted at rest.
- P2P/IPFS is an optional overflow or acceleration path; it never gates playback.

This is feasible for a small team: no tracker, STUN/TURN, or peer density is needed for a track to play.

## Request flows

### Upload

1. `POST /api/tracks` receives a multipart body with the file and metadata.
2. Auth, onboarding, `can_upload`, file type and per-user quota are checked.
3. `storeOnServer()` encrypts the file in 1 MiB AES-256-GCM chunks and writes a JSON sidecar containing the base IV and original size.
4. The `posts` row records `storage_type`, `server_storage_id`, `is_encrypted`, and `encryption_iv`.
5. The response includes a signed `streamUrl`.

If server quota is exhausted, files can be mirrored to IPFS via `storeOnP2P()`; the post records the CID instead. There is no magnet-based upload path in the active application.

### Playback

1. A client either uses `streamUrl` from the track API or calls `GET /api/media/token?trackId=<uuid>`.
2. `/api/media/token` returns `/api/media/<uuid>?token=<expires>.<hmac>` valid for one hour.
3. `<audio>` requests that URL. The browser attaches `Range` headers; no custom headers are needed.
4. `/api/media/:trackId` verifies the token (or an owner Bearer token), loads the post, and:
   - redirects to the IPFS gateway if it is an IPFS-only track;
   - otherwise reads only the encrypted chunks covering the requested plaintext range, decrypts them, and responds with `206 Partial Content` plus `Accept-Ranges`.
5. The player (`UnifiedMusicPlayer`) is native HTML5 audio with seek, skip, volume, buffered progress, and explicit error states.

### Social features

PostgreSQL tables in `src/lib/db/schema.sql` are the single source of truth. All API routes use the shared `query()` helper. Foreign keys and indexes are defined in the schema; broad `PUBLIC` grants were removed.

## Security properties

- `JWT_SECRET` and `ENCRYPTION_MASTER_KEY` have no insecure defaults; missing values fail fast.
- Media tokens are HMAC-SHA256 signed, track-scoped, short-lived, and compared in constant time.
- AES-256-GCM provides authenticated encryption at rest, chunk-local so byte ranges remain efficient.
- Storage identifiers are UUID-validated before being used as path components (no traversal).
- Media responses use `Cache-Control: private` and `X-Content-Type-Options: nosniff`.
- Background migration of server files to IPFS is disabled unless `ENABLE_P2P_MIGRATION=true`; IPFS remains a fallback, never an eviction mechanism.

## Known limitations

- The local filesystem storage path is single-node. Moving to S3-compatible object storage requires replacing `storeOnServer()`/`readMediaRange()` with object-store range reads; the API/player contract stays the same.
- There is no per-user rate limiting on `/api/media/token` yet.
- WebAuthn tables exist, but the browser registration ceremony is not fully wired.
- Background seeding and private swarms are not implemented. Browsers cannot reliably seed with a closed tab; a native daemon would be required.
- Monetization, edge autoscaling, and analytics mocks were removed rather than shipped as fake features.

## Tests

`npm test` covers:

- chunked encryption round-trips, cross-chunk range decryption, tamper detection;
- on-disk `readMediaRange` full-file and cross-chunk slices with sidecar metadata;
- media route range responses, 416 handling, IPFS-only redirects, and stale-server fallback;
- signed media URLs (valid, cross-track reuse, tampered, expired, playable-location gating);
- HTTP range header parsing;
- utility formatting.

`npm run typecheck` must pass before `npm run build`.
