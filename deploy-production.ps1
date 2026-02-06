# ProjectNews Full Production Deployment Script
# This script handles database migrations, frontend build, and API deployment

param(
    [switch]$SkipFrontend = $false,
    [switch]$SkipBackend = $false,
    [switch]$SkipMigrations = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================="
Write-Host "  ProjectNews Full Production Deployment"
Write-Host "=============================================="
Write-Host ""

# Configuration
$FrontendBuildPath = "frontend\dist\frontend\browser"
$IISDeployPath = "C:\inetpub\wwwroot\angular-app"
$BackupPath = "C:\Backups\projectnews"
$BackupTimestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

# Get script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Warning: Not running as Administrator. Some operations may fail." -ForegroundColor Yellow
}

Write-Host "[1/9] Stopping existing Node.js API processes..." -ForegroundColor Cyan
try {
    # Stop PM2 processes
    pm2 stop all 2>$null
    pm2 delete all 2>$null
    Write-Host "PM2 processes stopped" -ForegroundColor Green

    # Give processes time to shut down gracefully
    Start-Sleep -Seconds 2

    # Kill any remaining Node.js processes (nuclear option)
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "Killing remaining Node.js processes..." -ForegroundColor Yellow
        $nodeProcesses | Stop-Process -Force
        Write-Host "Killed $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Green
    }
} catch {
    Write-Host "Warning: Error stopping processes: $_" -ForegroundColor Yellow
}

if (-not $SkipMigrations) {
    Write-Host ""
    Write-Host "[2/9] Running database migrations..." -ForegroundColor Cyan
    try {
        Set-Location api

        # Generate Prisma client first
        Write-Host "Generating Prisma client..." -ForegroundColor Gray
        npx prisma generate

        # Run migrations
        Write-Host "Running migrations..." -ForegroundColor Gray
        npm run migrate:deploy

        Set-Location ..
        Write-Host "Database migrations completed successfully" -ForegroundColor Green
    } catch {
        Write-Host "Error running migrations: $_" -ForegroundColor Red
        Set-Location ..
        Write-Host "Continuing deployment despite migration error..." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[2/9] Skipping database migrations (--SkipMigrations flag)" -ForegroundColor Yellow
}

if (-not $SkipFrontend) {
    Write-Host ""
    Write-Host "[3/9] Building Angular frontend..." -ForegroundColor Cyan
    try {
        Set-Location frontend

        # Install dependencies if needed
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing frontend dependencies..." -ForegroundColor Gray
            npm install
        }

        # Clean previous build
        if (Test-Path "dist") {
            Write-Host "Cleaning previous build..." -ForegroundColor Gray
            Remove-Item -Path "dist" -Recurse -Force
        }

        # Build for production
        Write-Host "Building Angular app (this may take a few minutes)..." -ForegroundColor Gray
        npm run build -- --configuration production

        if (-not (Test-Path $FrontendBuildPath)) {
            throw "Build failed - output directory not found at $FrontendBuildPath"
        }

        Set-Location ..
        Write-Host "Frontend build completed successfully" -ForegroundColor Green
    } catch {
        Write-Host "Error building frontend: $_" -ForegroundColor Red
        Set-Location ..
        exit 1
    }

    Write-Host ""
    Write-Host "[4/9] Backing up current IIS deployment..." -ForegroundColor Cyan
    try {
        if (Test-Path $IISDeployPath) {
            $backupFolder = Join-Path $BackupPath "frontend_$BackupTimestamp"

            if (-not (Test-Path $BackupPath)) {
                New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
            }

            Write-Host "Creating backup at $backupFolder..." -ForegroundColor Gray
            Copy-Item -Path $IISDeployPath -Destination $backupFolder -Recurse -Force
            Write-Host "Backup created successfully" -ForegroundColor Green

            # Keep only last 5 backups
            $backups = Get-ChildItem $BackupPath | Sort-Object LastWriteTime -Descending
            if ($backups.Count -gt 5) {
                $backups | Select-Object -Skip 5 | Remove-Item -Recurse -Force
                Write-Host "Cleaned up old backups (keeping last 5)" -ForegroundColor Gray
            }
        } else {
            Write-Host "No existing deployment to backup" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Warning: Backup failed: $_" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "[5/9] Deploying frontend to IIS..." -ForegroundColor Cyan
    try {
        # Ensure IIS directory exists
        if (-not (Test-Path $IISDeployPath)) {
            Write-Host "Creating IIS directory..." -ForegroundColor Gray
            New-Item -ItemType Directory -Path $IISDeployPath -Force | Out-Null
        }

        # Copy built files to IIS
        Write-Host "Copying files to $IISDeployPath..." -ForegroundColor Gray
        Copy-Item -Path "$FrontendBuildPath\*" -Destination $IISDeployPath -Recurse -Force

        Write-Host "Frontend deployed to IIS successfully" -ForegroundColor Green
    } catch {
        Write-Host "Error deploying to IIS: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "[3/9] Skipping frontend build (--SkipFrontend flag)" -ForegroundColor Yellow
    Write-Host "[4/9] Skipping IIS backup (--SkipFrontend flag)" -ForegroundColor Yellow
    Write-Host "[5/9] Skipping IIS deployment (--SkipFrontend flag)" -ForegroundColor Yellow
}

if (-not $SkipBackend) {
    Write-Host ""
    Write-Host "[6/9] Installing/updating API dependencies..." -ForegroundColor Cyan
    try {
        Set-Location api

        Write-Host "Installing production dependencies..." -ForegroundColor Gray
        npm install --production

        Set-Location ..
        Write-Host "API dependencies updated successfully" -ForegroundColor Green
    } catch {
        Write-Host "Error installing API dependencies: $_" -ForegroundColor Red
        Set-Location ..
        exit 1
    }

    Write-Host ""
    Write-Host "[7/9] Creating logs directory..." -ForegroundColor Cyan
    if (-not (Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" | Out-Null
        Write-Host "Logs directory created" -ForegroundColor Green
    } else {
        Write-Host "Logs directory already exists" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "[8/9] Starting API with PM2..." -ForegroundColor Cyan
    try {
        pm2 start ecosystem.config.js

        # Wait for app to stabilize
        Write-Host "Waiting for API to start..." -ForegroundColor Gray
        Start-Sleep -Seconds 8

        # Check if app is running
        $status = pm2 jlist | ConvertFrom-Json
        $appRunning = $status | Where-Object { $_.name -eq "projectnews" -and $_.pm2_env.status -eq "online" }

        if ($appRunning) {
            Write-Host "API started successfully!" -ForegroundColor Green

            # Show API info
            $port = if ($appRunning.pm2_env.env.PORT) { $appRunning.pm2_env.env.PORT } else { "4000" }
            Write-Host "API running on port: $port" -ForegroundColor Cyan
        } else {
            Write-Host "Warning: API may not have started correctly. Checking logs..." -ForegroundColor Yellow
            pm2 logs --lines 20 --nostream
        }
    } catch {
        Write-Host "Error starting API: $_" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "[9/9] Saving PM2 configuration..." -ForegroundColor Cyan
    try {
        pm2 save
        Write-Host "PM2 configuration saved" -ForegroundColor Green
    } catch {
        Write-Host "Warning: Failed to save PM2 configuration: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[6/9] Skipping API dependencies (--SkipBackend flag)" -ForegroundColor Yellow
    Write-Host "[7/9] Skipping logs directory (--SkipBackend flag)" -ForegroundColor Yellow
    Write-Host "[8/9] Skipping API start (--SkipBackend flag)" -ForegroundColor Yellow
    Write-Host "[9/9] Skipping PM2 save (--SkipBackend flag)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=============================================="
Write-Host "  Deployment Complete!"
Write-Host "=============================================="
Write-Host ""

if (-not $SkipFrontend) {
    Write-Host "Frontend:" -ForegroundColor Cyan
    Write-Host "  - Built and deployed to IIS: $IISDeployPath" -ForegroundColor Green
    if (Test-Path $BackupPath) {
        Write-Host "  - Backup available at: $BackupPath" -ForegroundColor Gray
    }
}

if (-not $SkipBackend) {
    Write-Host ""
    Write-Host "Backend API:" -ForegroundColor Cyan
    Write-Host "  - Running with PM2" -ForegroundColor Green
    Write-Host "  - Check status: pm2 status" -ForegroundColor Gray
    Write-Host "  - View logs: pm2 logs" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  pm2 status          - View API status"
Write-Host "  pm2 logs            - View real-time logs"
Write-Host "  pm2 restart all     - Restart API"
Write-Host "  pm2 monit           - Monitor API"
Write-Host ""

# Final health check
if (-not $SkipBackend) {
    Write-Host "Running final health check..." -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    pm2 status
}

Write-Host ""
Write-Host "Deployment completed successfully! 🚀" -ForegroundColor Green
Write-Host ""
