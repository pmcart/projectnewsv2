# Quick Deployment Script
# Use this for quick updates without rebuilding everything
# For full deployment, use deploy-production.ps1

$ErrorActionPreference = "Stop"

Write-Host "=============================================="
Write-Host "  Quick Deploy - ProjectNews"
Write-Host "=============================================="
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "[1/4] Pulling latest changes..." -ForegroundColor Cyan
try {
    git pull origin master
    Write-Host "Code updated successfully" -ForegroundColor Green
} catch {
    Write-Host "Warning: Git pull failed: $_" -ForegroundColor Yellow
    Write-Host "Continuing with local changes..." -ForegroundColor Gray
}

Write-Host ""
Write-Host "[2/4] Updating API dependencies..." -ForegroundColor Cyan
Set-Location api
npm install --production
Set-Location ..

Write-Host ""
Write-Host "[3/4] Running database migrations..." -ForegroundColor Cyan
Set-Location api
npm run migrate:deploy
Set-Location ..

Write-Host ""
Write-Host "[4/4] Restarting API..." -ForegroundColor Cyan
pm2 restart all

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Quick deployment complete!" -ForegroundColor Green
pm2 status
