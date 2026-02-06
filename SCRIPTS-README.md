# Deployment Scripts Reference

This document provides a quick reference for all deployment scripts available.

## Scripts Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `deploy-production.ps1` | Full production deployment | Initial deployment or major updates |
| `quick-deploy.ps1` | Quick code updates | Routine updates after git pull |
| `rollback-frontend.ps1` | Rollback frontend to backup | When frontend deployment has issues |
| `deploy-windows.ps1` | Initial Windows setup | First-time server setup only |

## Script Details

### 1. deploy-production.ps1 (Recommended for most deployments)

**Full production deployment including frontend and backend.**

```powershell
.\deploy-production.ps1
```

**What it does:**
1. Stops all running Node.js processes
2. Runs Prisma database migrations
3. Builds Angular frontend in production mode
4. Creates backup of current IIS deployment
5. Deploys new frontend to IIS (`C:\inetpub\wwwroot\angular-app\`)
6. Updates API dependencies
7. Starts API with PM2
8. Verifies deployment health

**Optional Parameters:**
```powershell
# Skip frontend build and deployment
.\deploy-production.ps1 -SkipFrontend

# Skip backend API deployment
.\deploy-production.ps1 -SkipBackend

# Skip database migrations
.\deploy-production.ps1 -SkipMigrations

# Combine flags
.\deploy-production.ps1 -SkipFrontend -SkipMigrations
```

**Use Cases:**
- After making changes to frontend or backend
- After pulling code from git
- For scheduled production deployments
- When you need both frontend and backend updated

---

### 2. quick-deploy.ps1 (Fast Updates)

**Quick update for backend code changes only.**

```powershell
.\quick-deploy.ps1
```

**What it does:**
1. Pulls latest code from git
2. Updates API dependencies
3. Runs database migrations
4. Restarts PM2

**Use Cases:**
- Quick backend-only updates
- After minor code changes
- When you only modified API code
- Emergency hotfixes

---

### 3. rollback-frontend.ps1 (Emergency Rollback)

**Restore previous frontend deployment from backup.**

```powershell
.\rollback-frontend.ps1
```

**What it does:**
1. Lists last 5 frontend backups
2. Lets you select which backup to restore
3. Restores selected backup to IIS

**Use Cases:**
- Frontend deployment broke production
- Need to revert to previous version quickly
- Testing different frontend versions

**Note:** Backups are auto-created by `deploy-production.ps1` in `C:\Backups\projectnews\`

---

### 4. deploy-windows.ps1 (One-time Setup)

**Initial Windows server setup. Run once per server.**

```powershell
.\deploy-windows.ps1
```

**What it does:**
1. Installs PM2 globally
2. Installs pm2-windows-startup
3. Installs API dependencies
4. Runs migrations
5. Starts API
6. Configures PM2 auto-start

**Use Cases:**
- First-time server setup
- Setting up a new EC2 instance
- After reinstalling Node.js

---

## Common Workflows

### Daily Development Workflow

```powershell
# 1. Make code changes
# 2. Test locally
# 3. Commit and push to git
# 4. Deploy to production
.\quick-deploy.ps1
```

### Full Deployment (Frontend + Backend)

```powershell
.\deploy-production.ps1
```

### Backend Only Update

```powershell
.\deploy-production.ps1 -SkipFrontend
```

### Frontend Only Update

```powershell
.\deploy-production.ps1 -SkipBackend
```

### Emergency Rollback

```powershell
# Rollback frontend
.\rollback-frontend.ps1

# Rollback backend (manual)
pm2 stop all
# Restore from git
git reset --hard <commit-hash>
npm install
pm2 start ecosystem.config.js
```

---

## Deployment Checklist

Before deploying:
- [ ] Code tested locally
- [ ] Changes committed to git
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Backup location has space (`C:\Backups\projectnews\`)

After deploying:
- [ ] Check API status: `pm2 status`
- [ ] Check API logs: `pm2 logs --lines 50`
- [ ] Test frontend in browser
- [ ] Test API endpoints
- [ ] Verify database migrations ran

---

## Troubleshooting Scripts

### Check API Status
```powershell
pm2 status
pm2 logs
pm2 monit
```

### Manual Restart
```powershell
pm2 restart all
```

### Kill All Node Processes
```powershell
Get-Process -Name "node" | Stop-Process -Force
```

### Check IIS Deployment
```powershell
ls C:\inetpub\wwwroot\angular-app\
```

### Check Backups
```powershell
ls C:\Backups\projectnews\ | Sort-Object LastWriteTime -Descending
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `ecosystem.config.js` | PM2 configuration for API |
| `api\.env` | Environment variables for production |
| `frontend\angular.json` | Angular build configuration |
| `api\prisma\schema.prisma` | Database schema |

---

## Support

For detailed documentation, see:
- **Full Documentation**: [DEPLOYMENT-WINDOWS.md](DEPLOYMENT-WINDOWS.md)
- **PM2 Commands**: `pm2 --help`
- **Angular CLI**: `ng --help`

For issues:
- Check logs: `pm2 logs`
- Check PM2 docs: https://pm2.keymetrics.io/
- Check this repo's issues
