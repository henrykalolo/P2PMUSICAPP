#!/bin/bash
# Tracker setup script for EC2 instances
# This script installs and configures the WebTorrent tracker

set -e

REGION="${region}"
TRACKER_PORT="${tracker_port}"
GOSSIP_PORT="${gossip_port}"
HEALTH_PORT="${health_port}"

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 23.x
curl -fsSL https://deb.nodesource.com/setup_23.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Create tracker user
useradd -r -s /bin/false tracker || true

# Create tracker directory
mkdir -p /opt/tracker
cd /opt/tracker

# Create package.json
cat > package.json << 'EOF'
{
  "name": "p2p-music-tracker",
  "version": "1.0.0",
  "description": "WebTorrent tracker for P2P Music Platform",
  "main": "tracker.js",
  "scripts": {
    "start": "node tracker.js"
  },
  "dependencies": {
    "bittorrent-tracker": "^11.0.0",
    "express": "^4.18.0",
    "redis": "^4.6.0",
    "ws": "^8.14.0"
  }
}
EOF

# Install dependencies
npm install

# Create tracker application
cat > tracker.js << 'EOF'
const Server = require('bittorrent-tracker').Server;
const express = require('express');
const WebSocket = require('ws');
const Redis = require('redis');

const TRACKER_PORT = process.env.TRACKER_PORT || 8000;
const GOSSIP_PORT = process.env.GOSSIP_PORT || 8001;
const HEALTH_PORT = process.env.HEALTH_PORT || 8080;
const REGION = process.env.REGION || 'unknown';
const NODE_ID = process.env.NODE_ID || `tracker-${REGION}-${Date.now()}`;

// Redis client for cross-region synchronization
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.connect().catch(console.error);

// Create WebTorrent tracker server
const server = new Server({
  udp: false,
  http: false,
  ws: true,
  stats: true,
  filter: function (infoHash, params, cb) {
    // Validate torrent hash against database
    redis.get(`torrent:${infoHash}:allowed`).then(allowed => {
      if (allowed === 'true') {
        cb(null);
      } else {
        cb(new Error('Torrent not registered'));
      }
    }).catch(err => {
      console.error('Filter error:', err);
      cb(new Error('Filter check failed'));
    });
  }
});

// Track peer statistics
server.on('start', (addr, infoHash) => {
  console.log(`Peer started: ${addr} for ${infoHash}`);
  redis.incr(`stats:${infoHash}:peers`);
  redis.expire(`stats:${infoHash}:peers`, 3600);
});

server.on('stop', (addr, infoHash) => {
  console.log(`Peer stopped: ${addr} for ${infoHash}`);
  redis.decr(`stats:${infoHash}:peers`);
});

server.on('complete', (addr, infoHash) => {
  console.log(`Peer completed: ${addr} for ${infoHash}`);
  redis.incr(`stats:${infoHash}:completed`);
});

// Gossip protocol for inter-tracker communication
const gossipWSS = new WebSocket.Server({ port: GOSSIP_PORT });

const knownNodes = new Map();

gossipWSS.on('connection', (ws, req) => {
  console.log(`Gossip connection from ${req.socket.remoteAddress}`);
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'SWARM_UPDATE') {
        // Merge swarm data from other trackers
        await mergeSwarmData(message.swarmData);
      } else if (message.type === 'NODE_ANNOUNCE') {
        knownNodes.set(message.nodeId, {
          endpoint: message.endpoint,
          region: message.region,
          lastSeen: Date.now()
        });
      }
    } catch (err) {
      console.error('Gossip message error:', err);
    }
  });
  
  // Announce ourselves
  ws.send(JSON.stringify({
    type: 'NODE_ANNOUNCE',
    nodeId: NODE_ID,
    region: REGION,
    endpoint: `ws://${process.env.PUBLIC_IP || 'localhost'}:${GOSSIP_PORT}`
  }));
});

async function mergeSwarmData(swarmData) {
  // Store merged swarm data in Redis
  for (const [infoHash, data] of Object.entries(swarmData)) {
    await redis.setEx(
      `swarm:${infoHash}:remote`,
      300, // 5 minute TTL
      JSON.stringify(data)
    );
  }
}

// Health check endpoint
const healthApp = express();

healthApp.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    region: REGION,
    nodeId: NODE_ID,
    timestamp: Date.now(),
    tracker: {
      port: TRACKER_PORT,
      torrents: Object.keys(server.torrents).length,
      peers: Object.values(server.torrents).reduce((sum, t) => sum + t.peers.length, 0)
    },
    gossip: {
      port: GOSSIP_PORT,
      knownNodes: knownNodes.size
    },
    redis: redis.isReady ? 'connected' : 'disconnected'
  };
  
  res.status(200).json(health);
});

healthApp.get('/stats', (req, res) => {
  const stats = Object.keys(server.torrents).map(hash => {
    const swarm = server.torrents[hash];
    return {
      infoHash: hash,
      seeders: swarm.complete,
      leechers: swarm.incomplete,
      peers: swarm.peers.length,
      healthScore: swarm.complete > 0 ? 'healthy' : 'critical'
    };
  });
  
  res.json({
    region: REGION,
    nodeId: NODE_ID,
    torrents: stats,
    totalTorrents: stats.length,
    totalPeers: stats.reduce((sum, t) => sum + t.peers, 0)
  });
});

// Start servers
server.listen(TRACKER_PORT, () => {
  console.log(`WebTorrent tracker listening on port ${TRACKER_PORT}`);
  console.log(`Region: ${REGION}, Node ID: ${NODE_ID}`);
});

healthApp.listen(HEALTH_PORT, () => {
  console.log(`Health check endpoint on port ${HEALTH_PORT}`);
});

// Periodic gossip with other trackers
async function gossipWithPeers() {
  const trackerList = await redis.sMembers('trackers:all');
  
  for (const trackerEndpoint of trackerList) {
    if (trackerEndpoint.includes(NODE_ID)) continue;
    
    try {
      const ws = new WebSocket(trackerEndpoint);
      
      ws.on('open', () => {
        // Send our swarm summary
        const swarmData = {};
        for (const [hash, swarm] of Object.entries(server.torrents)) {
          swarmData[hash] = {
            seeders: swarm.complete,
            leechers: swarm.incomplete,
            timestamp: Date.now()
          };
        }
        
        ws.send(JSON.stringify({
          type: 'SWARM_UPDATE',
          nodeId: NODE_ID,
          swarmData
        }));
        
        ws.close();
      });
      
      ws.on('error', (err) => {
        console.error(`Gossip error with ${trackerEndpoint}:`, err.message);
      });
    } catch (err) {
      console.error(`Failed to gossip with ${trackerEndpoint}:`, err.message);
    }
  }
}

// Gossip every 5 seconds
setInterval(gossipWithPeers, 5000);

// Register ourselves in Redis
async function registerTracker() {
  const endpoint = `ws://${process.env.PUBLIC_IP || 'localhost'}:${GOSSIP_PORT}`;
  await redis.sAdd('trackers:all', endpoint);
  await redis.setEx(`tracker:${NODE_ID}:heartbeat`, 60, Date.now().toString());
}

// Heartbeat every 30 seconds
setInterval(registerTracker, 30000);
registerTracker();

console.log('Tracker node initialized');
EOF

# Set up environment file
cat > .env << EOF
REGION=${REGION}
TRACKER_PORT=${TRACKER_PORT}
GOSSIP_PORT=${GOSSIP_PORT}
HEALTH_PORT=${HEALTH_PORT}
NODE_ID=tracker-${REGION}-$(date +%s)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
REDIS_URL=redis://localhost:6379
EOF

# Set ownership
chown -R tracker:tracker /opt/tracker

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'tracker',
    script: './tracker.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

mkdir -p logs
chown -R tracker:tracker logs

# Create systemd service
cat > /etc/systemd/system/tracker.service << 'EOF'
[Unit]
Description=P2P Music WebTorrent Tracker
After=network.target

[Service]
Type=simple
User=tracker
WorkingDirectory=/opt/tracker
ExecStart=/usr/bin/pm2 start ecosystem.config.js --no-daemon
ExecReload=/usr/bin/pm2 reload ecosystem.config.js
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Install and configure Redis
apt-get install -y redis-server

# Configure Redis for persistence
cat >> /etc/redis/redis.conf << 'EOF'
# P2P Music Tracker specific settings
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF

systemctl enable redis-server
systemctl start redis-server

# Enable and start tracker service
systemctl daemon-reload
systemctl enable tracker
systemctl start tracker

# Set up log rotation
cat > /etc/logrotate.d/tracker << 'EOF'
/opt/tracker/logs/*.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  create 0644 tracker tracker
  sharedscripts
  postrotate
    /bin/kill -HUP $(cat /var/run/syslogd.pid 2> /dev/null) 2> /dev/null || true
  endscript
}
EOF

# Install CloudWatch agent for monitoring
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "metrics": {
    "namespace": "P2PMusic/Tracker",
    "metrics_collected": {
      "disk": {
        "measurement": ["used_percent"],
        "resources": ["*"]
      },
      "mem": {
        "measurement": ["mem_used_percent"]
      },
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/opt/tracker/logs/combined.log",
            "log_group_name": "p2p-music-tracker",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent

# Install fail2ban for security
apt-get install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[tracker]
enabled = true
port = 8000,8001,8080
filter = tracker
logpath = /opt/tracker/logs/combined.log
maxretry = 10
EOF

cat > /etc/fail2ban/filter.d/tracker.conf << 'EOF'
[Definition]
failregex = ^.*error.*client <HOST>.*$
ignoreregex =
EOF

systemctl enable fail2ban
systemctl start fail2ban

# Final status
echo "Tracker setup complete for region: ${REGION}"
echo "Tracker port: ${TRACKER_PORT}"
echo "Gossip port: ${GOSSIP_PORT}"
echo "Health port: ${HEALTH_PORT}"

# Output status
systemctl status tracker --no-pager || true
