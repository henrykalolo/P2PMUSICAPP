const { Server } = require('bittorrent-tracker');

const server = new Server({
  udp: false,
  http: false,
  ws: true,
  stats: true,
  
  // Filter to only allow torrents from our platform
  filter: function (infoHash, params, cb) {
    // In production, check database for valid infoHash
    // For now, allow all torrents
    cb(null);
  }
});

server.on('listening', () => {
  console.log(`WebTorrent Tracker running at ws://localhost:${server.ws.address().port}`);
  console.log('Tracker is ready for WebSocket connections');
});

server.on('error', (err) => {
  console.error('Tracker Error:', err.message);
});

server.on('warning', (err) => {
  console.warn('Tracker Warning:', err.message);
});

// Expose stats endpoint
const http = require('http');
const statsServer = http.createServer((req, res) => {
  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    const healthReport = Object.keys(server.torrents).map(hash => {
      const swarm = server.torrents[hash];
      return {
        infoHash: hash,
        seeders: swarm.complete,
        leechers: swarm.incomplete,
        healthScore: swarm.complete > 0 ? 'Healthy' : 'Critical'
      };
    });
    
    res.end(JSON.stringify({
      torrents: healthReport,
      totalTorrents: Object.keys(server.torrents).length
    }, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const TRACKER_PORT = process.env.TRACKER_PORT || 8000;
const STATS_PORT = process.env.STATS_PORT || 8001;

server.listen(TRACKER_PORT, () => {
  console.log(`Tracker WebSocket server listening on port ${TRACKER_PORT}`);
});

statsServer.listen(STATS_PORT, () => {
  console.log(`Tracker stats server listening on port ${STATS_PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down tracker...');
  server.close(() => {
    console.log('Tracker closed');
    process.exit(0);
  });
});
