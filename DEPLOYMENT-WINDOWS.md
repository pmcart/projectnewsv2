# ProjectNews - Windows Production Deployment Guide

This guide covers deploying the ProjectNews API on a Windows Server (IIS) EC2 instance.

## Prerequisites

- Windows Server with IIS installed
- Node.js v18+ installed
- Git installed
- Admin access to the server

## Deployment Options

### Option 1: Full Production Deployment (Recommended)

For complete deployment including frontend and backend:

```powershell
cd c:\Dev\projectnewsv2
.\deploy-production.ps1
```

This script will:
1. Stop existing Node.js processes
2. Run Prisma database migrations
3. Build Angular frontend (production mode)
4. Backup current IIS deployment
5. Deploy frontend to IIS
6. Install/update API dependencies
7. Start API with PM2
8. Save PM2 configuration

**Optional flags:**
```powershell
.\deploy-production.ps1 -SkipFrontend    # Skip frontend build and deployment
.\deploy-production.ps1 -SkipBackend     # Skip API deployment
.\deploy-production.ps1 -SkipMigrations  # Skip database migrations
```

### Option 2: Quick Update Deployment

For quick code updates without full rebuild:

```powershell
cd c:\Dev\projectnewsv2
.\quick-deploy.ps1
```

This script will:
1. Pull latest code from git
2. Update API dependencies
3. Run database migrations
4. Restart API with PM2

### Option 3: Manual Deployment

Follow these steps if you prefer manual control:

```powershell
# 1. Install PM2
npm install -g pm2 pm2-windows-startup

# 2. Install API dependencies
cd api
npm install --production

# 3. Run database migrations (if needed)
npm run migrate:deploy

# 4. Go back to project root
cd ..

# 5. Create logs directory
mkdir logs

# 6. Start with PM2
pm2 start ecosystem.config.js

# 7. Save PM2 process list
pm2 save

# 8. Configure Windows startup
pm2-startup install
```

## Environment Configuration

Make sure you have a `.env` file in the `api` folder with your production settings:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=your_database_connection_string
JWT_SECRET=your_jwt_secret
# Add other environment variables as needed
```

## PM2 Commands Reference

### Status and Monitoring
```powershell
pm2 status              # View application status
pm2 logs                # View real-time logs
pm2 logs --lines 100    # View last 100 log lines
pm2 monit               # Real-time monitoring dashboard
```

### Control
```powershell
pm2 restart all         # Restart application
pm2 stop all            # Stop application
pm2 start ecosystem.config.js  # Start application
pm2 delete all          # Remove from PM2
```

### Auto-restart on Boot
```powershell
pm2 save                # Save current process list
pm2-startup install     # Enable auto-start on Windows boot
pm2-startup uninstall   # Disable auto-start
```

## Firewall Configuration

### Windows Firewall
If you need external access to port 3000:

```powershell
New-NetFirewallRule -DisplayName "Node.js API - Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### EC2 Security Group
Add an inbound rule in your EC2 Security Group:
- Type: Custom TCP
- Port: 3000
- Source: Your IP or 0.0.0.0/0 (for public access)

## IIS Reverse Proxy Setup (Optional)

If you want IIS to handle requests and proxy to Node.js:

### 1. Install Required IIS Modules
- URL Rewrite Module
- Application Request Routing (ARR)

### 2. Configure IIS Site
1. Open IIS Manager
2. Select your website
3. Open "URL Rewrite"
4. Add a reverse proxy rule to `http://localhost:3000`

### 3. Sample web.config
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="ReverseProxyToNode" stopProcessing="true">
                    <match url="(.*)" />
                    <action type="Rewrite" url="http://localhost:3000/{R:1}" />
                </rule>
            </rules>
        </rewrite>
    </system.webServer>
</configuration>
```

## Updating the Application

### Quick Update (Recommended)
```powershell
.\quick-deploy.ps1
```

### Full Redeployment
```powershell
.\deploy-production.ps1
```

### Manual Update
```powershell
# 1. Stop API
pm2 stop all

# 2. Pull latest changes
git pull origin master

# 3. Update API dependencies
cd api
npm install --production

# 4. Run migrations
npm run migrate:deploy
cd ..

# 5. Rebuild frontend (if needed)
cd frontend
npm run build -- --configuration production

# 6. Deploy frontend to IIS
Copy-Item "dist\frontend\browser\*" "C:\inetpub\wwwroot\angular-app\" -Recurse -Force
cd ..

# 7. Restart API
pm2 restart all
pm2 save
```

## Rollback

If a deployment causes issues, you can rollback the frontend:

```powershell
.\rollback-frontend.ps1
```

This script will:
- Show available backups (last 5)
- Let you select which backup to restore
- Restore the selected backup to IIS

**Note:** Backups are automatically created during deployment and stored in `C:\Backups\projectnews\`. Only the last 5 backups are kept.

## Troubleshooting

### Application Won't Start
1. Check logs: `pm2 logs`
2. Verify environment variables in `api\.env`
3. Check database connection
4. Ensure port 3000 is not in use: `netstat -an | findstr :3000`

### High Restart Count
If PM2 shows many restarts:
```powershell
pm2 logs --lines 50  # Check for errors
```

### PM2 Not Starting on Boot
```powershell
# Reinstall startup configuration
pm2-startup install
pm2 save
```

### Permission Issues
Run PowerShell or Command Prompt as Administrator

## Production Checklist

- [ ] `.env` file configured with production settings
- [ ] Database migrations completed
- [ ] EC2 Security Group configured
- [ ] Windows Firewall configured (if needed)
- [ ] PM2 auto-startup configured
- [ ] Application logs are being written to `logs/` directory
- [ ] IIS reverse proxy configured (if using)
- [ ] SSL/HTTPS configured (if needed)
- [ ] Backup strategy in place

## Support

For issues or questions:
- Check application logs: `pm2 logs`
- Review PM2 documentation: https://pm2.keymetrics.io/
- Check Node.js documentation: https://nodejs.org/

## Architecture

### Current Setup
```
Frontend (Angular) → IIS (Port 80/443)
API (Node.js)      → PM2 → Port 3000
```

### With IIS Reverse Proxy
```
Frontend (Angular) → IIS (Port 80/443)
                     ↓
API (Node.js)      → PM2 → localhost:3000
```

## Security Notes

1. **Environment Variables**: Never commit `.env` files to git
2. **Firewall**: Only open port 3000 if absolutely necessary
3. **IIS Proxy**: Recommended for production to handle SSL/TLS
4. **Database**: Use secure connection strings with proper authentication
5. **JWT Secret**: Use a strong, random JWT_SECRET in production

---

*Last Updated: 2026-02-05*
