# P2P Music Platform - Phase 1 Setup Guide

## Overview

Phase 1 of the P2P Music Platform has been initialized with the following components:

- Next.js 15 with TypeScript
- Tailwind CSS for styling
- PostgreSQL database with complete schema
- WebTorrent P2P infrastructure
- WebAuthn passwordless authentication
- Onboarding system with music preferences
- Social features (follow, like, share)
- Upload functionality with metadata extraction

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── onboarding/    # Onboarding endpoints
│   │   │   ├── social/        # Social features endpoints
│   │   │   ├── tracks/        # Track management endpoints
│   │   │   └── upload/        # Upload endpoints
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/
│   │   ├── feed/              # Feed components
│   │   ├── player/            # P2P player components
│   │   ├── ui/                # UI components (shadcn)
│   │   └── upload/            # Upload components
│   ├── lib/
│   │   ├── auth/              # Authentication utilities
│   │   ├── db/                # Database utilities
│   │   ├── p2p/               # P2P utilities
│   │   └── utils.ts           # Utility functions
│   ├── store/                 # Zustand stores
│   └── middleware.ts          # Next.js middleware
├── scripts/
│   └── migrate.js             # Database migration script
├── tracker.js                 # WebTorrent tracker server
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.ts         # Tailwind configuration
├── next.config.js             # Next.js configuration
└── .env.example               # Environment variables template
```

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 3. Set Up PostgreSQL

Install PostgreSQL 17 and create the database:

```bash
# Ubuntu/Debian
sudo apt install postgresql-17
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE musicapp;"
sudo -u postgres psql -c "CREATE USER musicuser WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE musicapp TO musicuser;"
```

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start the WebTorrent Tracker

```bash
npm run tracker:start
# Or directly:
node tracker.js
```

### 6. Start the Development Server

```bash
npm run dev
```

## Key Features Implemented

### 1. Authentication System
- WebAuthn/Passkey-based passwordless authentication
- JWT token management
- Secure credential storage

### 2. Onboarding Flow
- Music preferences selection (minimum 5)
- User discovery and following (minimum 10)
- Founder user exemption (first 11 users)

### 3. P2P Audio Player
- WebTorrent-based streaming
- Sequential piece selection for instant playback
- Real-time peer count display
- Seeding status indicator

### 4. Social Features
- Follow/unfollow users
- Like tracks
- Share magnet links
- Social feed from followed users

### 5. Upload System
- Drag-and-drop file upload
- Metadata extraction from audio files
- Torrent creation and seeding
- Upload quota management

### 6. Database Schema
- Users table with artist capabilities
- Music preferences
- Social graph (follows)
- Posts (tracks)
- Interactions (likes, comments)
- WebAuthn credentials

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Onboarding
- `GET /api/onboarding/status` - Check onboarding status
- `POST /api/onboarding/preferences` - Save music preferences
- `GET /api/onboarding/suggested-users` - Get suggested users

### Tracks
- `GET /api/tracks` - List tracks from followed users
- `POST /api/tracks` - Upload new track

### Social
- `POST /api/social/follow` - Follow a user
- `DELETE /api/social/follow` - Unfollow a user

### Upload
- `POST /api/upload` - Initialize upload session

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/musicapp

# Security
JWT_SECRET=your-random-64-byte-hex
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME="P2P Music Platform"
WEBAUTHN_ORIGIN=http://localhost:3000

# P2P
TRACKER_URL=ws://localhost:8000
STUN_SERVER=stun:stun.l.google.com:19302

# Feature Flags
ENABLE_P2P=true
ENABLE_BACKGROUND_SEEDING=true
```

## Next Steps

1. **Install dependencies** with `npm install`
2. **Set up PostgreSQL** database
3. **Configure environment variables**
4. **Run migrations** to create database tables
5. **Start the tracker** server
6. **Start the dev server** and test the application

## Notes

- The TypeScript errors shown in the editor are expected until dependencies are installed
- WebTorrent requires browser environment - server-side rendering is handled carefully
- The tracker runs as a separate Node.js process
- Founder users (first 11) bypass onboarding requirements
