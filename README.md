# P2P Music Platform

A decentralized, peer-to-peer music streaming and social platform that eliminates central server dependencies through **WebTorrent** and **WebRTC** technologies.

## Overview

This platform employs a "Social-Directed Storage" model where users collectively host music content for artists they support. By leveraging modern web technologies, we create a privacy-first, sustainable alternative to centralized music streaming services.

### Key Features

- **Decentralized Architecture** - No single points of failure, reduced infrastructure costs
- **Privacy-First** - End-to-end encryption with user-controlled data sharing
- **Social Integration** - Music discovery through trusted social connections
- **Sustainable** - Distributed storage reduces environmental impact vs. centralized data centers
- **Offline Capable** - Service workers enable offline playback of cached content

## Technology Stack

### Frontend
- **Next.js 15** - Server-side rendering, static generation
- **React 19** - Component-based UI architecture
- **shadcn/ui** - Accessible, customizable UI components
- **Tailwind CSS 4** - Utility-first CSS framework
- **Zustand 5** - Lightweight state management
- **Web Audio API** - Real-time audio analysis and effects

### P2P Infrastructure
- **WebTorrent** - Browser-based torrent client
- **WebRTC** - Peer-to-peer connections
- **Simple Peer** - WebRTC wrapper for data channels
- **IPFS** (optional) - Distributed file storage

### Backend & Services
- **Supabase** - PostgreSQL database, authentication, real-time subscriptions
- **Node.js** - API routes and signaling server

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/p2p-music-platform.git
cd p2p-music-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Architecture

The platform uses a hybrid architecture:

1. **Social-Directed Storage** - Users seed content for artists they follow
2. **WebRTC Mesh** - Direct peer connections for real-time features
3. **Supabase Backend** - Metadata, user management, and signaling
4. **Service Workers** - Offline caching and background sync

## Documentation

For detailed technical specifications, see [Documentation.md](./Documentation.md).

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- WebTorrent community for P2P streaming technology
- WebRTC contributors for peer-to-peer connectivity
- shadcn/ui for the component library