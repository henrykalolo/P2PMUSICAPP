# P2P Music Platform

A decentralized music streaming and social platform built around WebTorrent, WebRTC, and user-controlled content distribution.

## Highlights

- Peer-to-peer music delivery using WebTorrent and WebRTC
- Social discovery through trusted connections
- Privacy-conscious architecture with user-controlled sharing
- Offline playback through browser caching and service workers
- Optional distributed storage integrations

## Technology

- Next.js 15 and React 19
- TypeScript and Tailwind CSS
- Zustand for client state
- Web Audio API for audio experiences
- WebTorrent, WebRTC, and Simple Peer
- Supabase for authentication, PostgreSQL, and realtime data

## Requirements

- Node.js 18+
- pnpm, npm, or yarn
- Git
- A Supabase project for authenticated or persistent features

## Installation

```bash
git clone https://github.com/henrykalolo/P2PMUSICAPP.git
cd P2PMUSICAPP
npm install
cp .env.example .env.local
```

Set the required Supabase and application values in `.env.local`, then start the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in a browser.

## Quality checks

```bash
npm run build
npm run lint
npm test
```

## Documentation

- [Setup guide](SETUP.md)
- [Technical specification](TECHNICAL_SPECIFICATION.md)
- [Project documentation](Documentation.md)
- [Roadmap](PHASE2.md), [Phase 3](PHASE3.md), and [Phase 4](PHASE4.md)

## Contributing

Please open an issue for significant proposals, keep pull requests focused, and include tests or documentation for user-facing changes.

## License

MIT License. See [LICENSE](LICENSE) if present.
