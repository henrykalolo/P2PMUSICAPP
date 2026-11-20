#!/bin/bash

# TURN Server Setup Script for P2P Music Platform
# This script installs and configures Coturn on Ubuntu/Debian systems

set -e

echo "=== P2P Music Platform - TURN Server Setup ==="
echo

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (use sudo)"
  exit 1
fi

# Configuration
TURN_PORT=${TURN_PORT:-3478}
TURN_TLS_PORT=${TURN_TLS_PORT:-5349}
TURN_USER=${TURN_USER:-turnuser}
TURN_PASSWORD=${TURN_PASSWORD:-$(openssl rand -base64 32)}
DOMAIN=${DOMAIN:-localhost}

# Update system
echo "[1/7] Updating system packages..."
apt-get update -qq

# Install Coturn
echo "[2/7] Installing Coturn..."
apt-get install -y -qq coturn

# Backup original config
echo "[3/7] Backing up original configuration..."
cp /etc/turnserver.conf /etc/turnserver.conf.backup.$(date +%Y%m%d) 2>/dev/null || true

# Generate config
echo "[4/7] Generating TURN server configuration..."
cat > /etc/turnserver.conf << EOF
# Coturn TURN Server Configuration
# Generated for P2P Music Platform

# Listener ports
listening-port=${TURN_PORT}
tls-listening-port=${TURN_TLS_PORT}

# IP addresses (auto-detect)
listening-ip=0.0.0.0
relay-ip=0.0.0.0
external-ip=\$(detect-external-ip)

# Realm
realm=${DOMAIN}

# Authentication
lt-cred-mech
user=${TURN_USER}:${TURN_PASSWORD}

# Security
fingerprint
no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1

# Performance
max-allocate-lifetime=3600
min-port=10000
max-port=20000

# Logging
log-file=/var/log/turnserver.log
simple-log

# WebRTC optimization
stale-nonce=600
total-quota=100
bps-capacity=0

# Certificate paths (for TLS)
# cert=/etc/letsencrypt/live/\${DOMAIN}/fullchain.pem
# pkey=/etc/letsencrypt/live/\${DOMAIN}/privkey.pem
EOF

# Create log file
echo "[5/7] Setting up logging..."
touch /var/log/turnserver.log
chown turnserver:turnserver /var/log/turnserver.log

# Enable and start service
echo "[6/7] Enabling and starting TURN server..."
systemctl enable coturn
systemctl restart coturn

# Configure firewall
echo "[7/7] Configuring firewall..."
if command -v ufw &> /dev/null; then
  ufw allow ${TURN_PORT}/tcp
  ufw allow ${TURN_PORT}/udp
  ufw allow ${TURN_TLS_PORT}/tcp
  ufw allow 10000:20000/udp
  echo "  - UFW rules added"
elif command -v iptables &> /dev/null; then
  iptables -I INPUT -p tcp --dport ${TURN_PORT} -j ACCEPT
  iptables -I INPUT -p udp --dport ${TURN_PORT} -j ACCEPT
  iptables -I INPUT -p tcp --dport ${TURN_TLS_PORT} -j ACCEPT
  iptables -I INPUT -p udp --dport 10000:20000 -j ACCEPT
  echo "  - iptables rules added"
fi

# Print configuration
echo
echo "=== TURN Server Setup Complete ==="
echo
echo "Configuration Summary:"
echo "  - TURN URI:  turn:${DOMAIN}:${TURN_PORT}"
echo "  - TURNS URI: turns:${DOMAIN}:${TURN_TLS_PORT}"
echo "  - Username:  ${TURN_USER}"
echo "  - Password:  ${TURN_PASSWORD}"
echo
echo "Add these to your .env.local file:"
echo "  NEXT_PUBLIC_TURN_SERVER=turn:${DOMAIN}:${TURN_PORT}"
echo "  NEXT_PUBLIC_TURN_USERNAME=${TURN_USER}"
echo "  NEXT_PUBLIC_TURN_PASSWORD=${TURN_PASSWORD}"
echo
echo "Service Status:"
systemctl status coturn --no-pager -l

echo
echo "To test the TURN server:"
echo "  turnutils_uclient -u ${TURN_USER} -w ${TURN_PASSWORD} turn:${DOMAIN}:${TURN_PORT}"
echo
