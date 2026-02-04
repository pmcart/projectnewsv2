#!/bin/bash

# ProjectNews Production Deployment Script
# Run this script on your EC2 instance after cloning the repo

set -e  # Exit on any error

echo "=============================================="
echo "  ProjectNews Production Deployment"
echo "=============================================="
echo ""

# Check if running as appropriate user
if [ "$EUID" -eq 0 ]; then
  echo "Warning: Running as root. Consider using a non-root user."
fi

# Navigate to project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/7] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
fi
echo "Node version: $(node -v)"
echo ""

echo "[2/7] Installing PM2 globally..."
npm install -g pm2
echo ""

echo "[3/7] Installing API dependencies..."
cd api
npm install --production
npm run migrate:deploy
cd ..
echo ""

echo "[4/7] Installing frontend dependencies..."
cd frontend
npm install
echo ""

echo "[5/7] Building Angular frontend for production..."
npm run build
cd ..
echo ""

echo "[6/7] Creating logs directory..."
mkdir -p logs
echo ""

echo "[7/7] Starting application with PM2..."
# Stop existing instance if running
pm2 delete projectnews 2>/dev/null || true

# Start with ecosystem config
pm2 start ecosystem.config.js

# Save PM2 process list for auto-restart on reboot
pm2 save

# Setup PM2 to start on system boot
pm2 startup | tail -1 | bash 2>/dev/null || echo "Run 'pm2 startup' manually if needed"

echo ""
echo "=============================================="
echo "  Deployment Complete!"
echo "=============================================="
echo ""
echo "Application is running on port 3000"
echo ""
echo "Useful commands:"
echo "  pm2 status        - View app status"
echo "  pm2 logs          - View logs"
echo "  pm2 restart all   - Restart app"
echo "  pm2 stop all      - Stop app"
echo ""
echo "To access externally, ensure:"
echo "  1. EC2 Security Group allows inbound traffic on port 3000"
echo "  2. Or set up nginx as a reverse proxy (see nginx.conf.example)"
echo ""
