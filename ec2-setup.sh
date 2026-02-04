#!/bin/bash

# EC2 Initial Setup Script
# Run this FIRST on a fresh EC2 instance before deploy.sh
# Supports Amazon Linux 2023 / Amazon Linux 2 / Ubuntu

set -e

echo "=============================================="
echo "  EC2 Initial Setup for ProjectNews"
echo "=============================================="
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS="unknown"
fi

echo "Detected OS: $OS"
echo ""

# Update system
echo "[1/5] Updating system packages..."
if [[ "$OS" == "amzn" ]]; then
    sudo yum update -y
elif [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    sudo apt-get update && sudo apt-get upgrade -y
fi
echo ""

# Install Node.js 20.x
echo "[2/5] Installing Node.js 20.x..."
if [[ "$OS" == "amzn" ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
elif [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo ""

# Install Git
echo "[3/5] Installing Git..."
if [[ "$OS" == "amzn" ]]; then
    sudo yum install -y git
elif [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    sudo apt-get install -y git
fi
echo ""

# Install nginx (optional but recommended)
echo "[4/5] Installing Nginx..."
if [[ "$OS" == "amzn" ]]; then
    sudo yum install -y nginx
    sudo systemctl enable nginx
elif [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
fi
echo ""

# Install PM2 globally
echo "[5/5] Installing PM2..."
sudo npm install -g pm2
echo ""

echo "=============================================="
echo "  EC2 Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Clone your repository:"
echo "   git clone https://github.com/your-repo/projectnews.git"
echo "   cd projectnews"
echo ""
echo "2. Create your .env file:"
echo "   cp api/.env.example api/.env"
echo "   nano api/.env  # Edit with your values"
echo ""
echo "3. Run the deployment:"
echo "   chmod +x deploy.sh"
echo "   ./deploy.sh"
echo ""
echo "4. (Optional) Set up nginx reverse proxy:"
echo "   sudo cp nginx.conf.example /etc/nginx/sites-available/projectnews"
echo "   sudo ln -s /etc/nginx/sites-available/projectnews /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl restart nginx"
echo ""
echo "5. Open firewall ports in EC2 Security Group:"
echo "   - Port 80 (HTTP)"
echo "   - Port 443 (HTTPS, if using SSL)"
echo "   - Port 3000 (if accessing Node directly)"
echo ""
