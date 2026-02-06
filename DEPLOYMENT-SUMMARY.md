# ProjectNews - Deployment Summary

## ✅ Current Setup

### API Status
- **Status**: Running successfully with PM2
- **Port**: 4000 (configured in `api\.env`)
- **Mode**: Fork mode (more stable for Windows)
- **Auto-start**: Configured with PM2 Windows startup
- **Logs**: `logs/error.log` and `logs/output.log`

### Frontend Status
- **Location**: `C:\inetpub\wwwroot\angular-app\`
- **Server**: IIS
- **Build**: Production optimized

### Database
- **Type**: MongoDB
- **Migrations**: Managed with Prisma
- **Connection**: Configured via `MONGODB_URI` in `.env`

---

## 📝 Available Scripts

### Main Deployment Scripts

1. **deploy-production.ps1** - Full production deployment
   - Builds frontend
   - Deploys to IIS
   - Updates and restarts API
   - Creates automatic backups
   - **Use this for most deployments**

2. **quick-deploy.ps1** - Quick backend updates
   - Pulls from git
   - Updates dependencies
   - Runs migrations
   - Restarts API
   - **Use for quick backend-only updates**

3. **rollback-frontend.ps1** - Emergency rollback
   - Restores previous frontend version
   - **Use if deployment breaks production**

4. **deploy-windows.ps1** - Initial setup
   - First-time server configuration
   - **Already completed**

See [SCRIPTS-README.md](SCRIPTS-README.md) for detailed usage.

---

## 🚀 Quick Start Guide

### Daily Deployment
```powershell
# After making changes and testing locally:
cd C:\Dev\projectnewsv2
.\deploy-production.ps1
```

### Quick Backend Update
```powershell
cd C:\Dev\projectnewsv2
.\quick-deploy.ps1
```

### Check Status
```powershell
pm2 status
pm2 logs --lines 30
```

---

## 🔧 Configuration Files Modified

The following files were created or modified during setup:

### Created Files
- `deploy-production.ps1` - Main deployment script
- `quick-deploy.ps1` - Quick update script
- `rollback-frontend.ps1` - Rollback script
- `DEPLOYMENT-WINDOWS.md` - Full deployment documentation
- `SCRIPTS-README.md` - Scripts reference guide
- `DEPLOYMENT-SUMMARY.md` - This file

### Modified Files
- `ecosystem.config.js` - PM2 configuration (fork mode, no env_file)
- `api/src/app.js` - Disabled production static file serving (line 56-67)
  - Frontend is served by IIS, not Node.js
  - Prevents Express v5 route pattern errors

---

## ⚠️ Important Notes

### API Port
Your API runs on **port 4000** (from `.env`), not 3000 as originally configured.
- Update IIS reverse proxy to point to `http://localhost:4000`
- Or update frontend API calls to use port 4000

### Frontend Serving
Frontend is served by IIS, NOT by the Node.js API.
- Angular app: `C:\inetpub\wwwroot\angular-app\`
- Node.js API: Only serves API endpoints at `/api/*`

### Backups
Frontend backups are automatically created at:
- Location: `C:\Backups\projectnewsv2\`
- Retention: Last 5 backups
- Format: `frontend_YYYY-MM-DD_HH-mm-ss`

### PM2 Windows Warning
The `spawn wmic ENOENT` errors in PM2 logs are harmless Windows compatibility warnings. They don't affect the app.

---

## 📁 Directory Structure

```
c:\Dev\projectnewsv2\
├── api/                          # Node.js API
│   ├── src/
│   │   ├── server.js            # Entry point
│   │   └── app.js               # Express app (modified)
│   ├── .env                     # Environment variables
│   ├── prisma/                  # Database schema & migrations
│   └── package.json
│
├── frontend/                     # Angular app
│   ├── src/
│   ├── dist/                    # Build output
│   └── angular.json
│
├── logs/                         # PM2 logs
│   ├── error.log
│   └── output.log
│
├── ecosystem.config.js           # PM2 config (modified)
├── deploy-production.ps1         # Main deployment script
├── quick-deploy.ps1              # Quick update script
├── rollback-frontend.ps1         # Rollback script
├── DEPLOYMENT-WINDOWS.md         # Full documentation
├── SCRIPTS-README.md             # Scripts reference
└── DEPLOYMENT-SUMMARY.md         # This file
```

---

## 🎯 Next Steps

1. **Update Frontend API URL**
   - Update Angular environment files to point to port 4000
   - Or configure IIS reverse proxy for port 4000

2. **Configure Windows Firewall** (if needed)
   ```powershell
   New-NetFirewallRule -DisplayName "Node.js API" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
   ```

3. **Configure EC2 Security Group**
   - Add inbound rule for port 4000 (if accessing externally)

4. **Set up IIS Reverse Proxy** (recommended)
   - Install URL Rewrite and ARR modules
   - Configure proxy to `http://localhost:4000`
   - See [DEPLOYMENT-WINDOWS.md](DEPLOYMENT-WINDOWS.md) for details

5. **Test Full Deployment**
   ```powershell
   .\deploy-production.ps1
   ```

---

## 📞 Support & Resources

- **Full Documentation**: [DEPLOYMENT-WINDOWS.md](DEPLOYMENT-WINDOWS.md)
- **Scripts Guide**: [SCRIPTS-README.md](SCRIPTS-README.md)
- **PM2 Docs**: https://pm2.keymetrics.io/
- **Check Logs**: `pm2 logs`
- **Check Status**: `pm2 status`

---

## ✨ Summary

Your production environment is now fully configured with:
- ✅ Automated deployment scripts
- ✅ Database migration support
- ✅ Automatic frontend backups
- ✅ PM2 process management
- ✅ Windows startup integration
- ✅ Error recovery and rollback capability

Simply run `.\deploy-production.ps1` whenever you need to deploy! 🚀
