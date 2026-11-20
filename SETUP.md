# Local development setup

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- No Redis, tracker, or TURN server is required for the core app.

## Steps

```bash
npm install
cp .env.example .env.local
```

In `.env.local`, set:

```
DATABASE_URL=postgresql://musicapp:password@localhost:5432/musicapp
JWT_SECRET=<64 hex characters>
ENCRYPTION_MASTER_KEY=<64 hex characters>
```

Generate secrets with:

```bash
openssl rand -hex 32
```

Create the database (example):

```bash
sudo -u postgres psql -c "CREATE DATABASE musicapp;"
sudo -u postgres psql -c "CREATE USER musicapp WITH PASSWORD 'password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE musicapp TO musicapp;"
```

Then apply the schema and start the app:

```bash
npm run db:setup
ADMIN_PASSWORD='choose-a-long-password' npm run db:seed-admin
npm run dev
```

Open http://localhost:3000.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

`db:setup` is idempotent and re-applies `src/lib/db/schema.sql`. It reads `DATABASE_URL` from the environment, `.env`, or `.env.local`.

## Optional services

IPFS is optional; the application does not require it for upload or playback. Helia helpers use a public gateway by default and require no environment variables. WebTorrent and Redis helpers were removed because no active code path used them.

## Common problems

- **"JWT_SECRET is not configured"** — set it in `.env.local` and restart the dev server.
- **"ENCRYPTION_MASTER_KEY must be set"** — generate a 64-character hex key. Never change it after storing files unless you intend to lose access to them.
- **Migration errors about existing objects** — the schema is idempotent; if an older partially applied schema exists, compare it with `src/lib/db/schema.sql` rather than dropping data blindly.
