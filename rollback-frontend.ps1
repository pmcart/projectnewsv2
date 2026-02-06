# Frontend Rollback Script
# Restores the most recent frontend backup

$ErrorActionPreference = "Stop"

$BackupPath = "C:\Backups\projectnews"
$IISDeployPath = "C:\inetpub\wwwroot\angular-app"

Write-Host "=============================================="
Write-Host "  Frontend Rollback"
Write-Host "=============================================="
Write-Host ""

# Check if backups exist
if (-not (Test-Path $BackupPath)) {
    Write-Host "Error: No backups found at $BackupPath" -ForegroundColor Red
    exit 1
}

# Get most recent backup
$backups = Get-ChildItem $BackupPath | Sort-Object LastWriteTime -Descending

if ($backups.Count -eq 0) {
    Write-Host "Error: No backup folders found" -ForegroundColor Red
    exit 1
}

Write-Host "Available backups:" -ForegroundColor Cyan
for ($i = 0; $i -lt [Math]::Min(5, $backups.Count); $i++) {
    Write-Host "  [$i] $($backups[$i].Name) - $($backups[$i].LastWriteTime)" -ForegroundColor Gray
}

Write-Host ""
$selection = Read-Host "Select backup to restore (0 for most recent, or Enter to cancel)"

if ([string]::IsNullOrWhiteSpace($selection)) {
    Write-Host "Rollback cancelled" -ForegroundColor Yellow
    exit 0
}

$selectedBackup = $backups[[int]$selection]

Write-Host ""
Write-Host "Rolling back to: $($selectedBackup.Name)" -ForegroundColor Yellow
Write-Host "This will replace: $IISDeployPath" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Are you sure? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Rollback cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Restoring backup..." -ForegroundColor Cyan

try {
    # Remove current deployment
    if (Test-Path $IISDeployPath) {
        Remove-Item -Path "$IISDeployPath\*" -Recurse -Force
    }

    # Restore backup
    Copy-Item -Path "$($selectedBackup.FullName)\*" -Destination $IISDeployPath -Recurse -Force

    Write-Host ""
    Write-Host "Rollback completed successfully!" -ForegroundColor Green
    Write-Host "Frontend restored from backup: $($selectedBackup.Name)" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "Error during rollback: $_" -ForegroundColor Red
    exit 1
}
