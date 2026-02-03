# P2P Music Platform - Local Development Setup Guide

## Overview

This guide covers setting up the P2P Music Platform for local development without Docker.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- WebTorrent CLI (optional, for tracker)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 3. Set Up Database

```bash
# Option A: Automated setup (recommended)
npm run db:setup

# Option B: Manual setup
# Install PostgreSQL and create database
sudo apt install postgresql-15
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE musicapp;"
sudo -u postgres psql -c "CREATE USER musicuser WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE musicapp TO musicuser;"

# Run migrations
npm run db:migrate
```

### 4. Start All Services

```bash
# Start everything (tracker + redis + dev server)
npm run dev:full

# Or start individually:
npm run tracker:start  # WebTorrent tracker on port 8000
npm run redis:start    # Redis on port 6379
npm run dev            # Next.js app on port 3000
```

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Test Structure

```
src/tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests (if configured)
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:setup` | Set up database and run migrations |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with test data |
| `npm run tracker:start` | Start WebTorrent tracker |
| `npm run redis:start` | Start Redis server |
| `npm run services:start` | Start all services (tracker + redis) |
| `npm run dev:full` | Start all services + dev server |
| `npm test` | Run tests with Vitest |

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://musicuser:yourpassword@localhost:5432/musicapp

# Security
JWT_SECRET=your-random-64-byte-hex
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME="P2P Music Platform"
WEBAUTHN_ORIGIN=http://localhost:3000

# P2P
TRACKER_URL=ws://localhost:8000
NEXT_PUBLIC_TURN_SERVER=turn:localhost:3478

# Feature Flags
ENABLE_P2P=true
ENABLE_BACKGROUND_SEEDING=true
```

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# Start Redis
redis-server
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000  # Next.js
lsof -i :8000  # Tracker
lsof -i :6379  # Redis

# Kill process
kill -9 <PID>
```
