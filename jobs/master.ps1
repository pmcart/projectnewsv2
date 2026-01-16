param(
    [switch]$DryRun,
    [switch]$SkipChrome,
    [int]$ChromeWaitSeconds = 60
)

$ErrorActionPreference = 'Stop'

# Resolve script root
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Paths to scripts
$OpenChromePath = Join-Path $ScriptRoot 'openChromeTabs.ps1'
$TwitterScraperPath = Join-Path $ScriptRoot 'twitterscraper.mjs'
$EnrichBreakingNewsPath = Join-Path $ScriptRoot 'enrichbreakingnews.mjs'
$GetBreakingNewsMediaPath = Join-Path $ScriptRoot 'getbreakingnewsmedia.js'

function Invoke-NodeScript([string]$Path) {
    if (-not (Test-Path $Path)) { throw "Node script not found: $Path" }
    Write-Host "Running Node script: $Path"
    & node $Path
    if ($LASTEXITCODE -ne 0) { throw "Node script failed: $Path (exit $LASTEXITCODE)" }
}

function Run-Sequence {
    if (-not $SkipChrome) {
        if (-not (Test-Path $OpenChromePath)) { throw "PowerShell script not found: $OpenChromePath" }
        Write-Host "Launching Chrome tabs via: $OpenChromePath"
        & $OpenChromePath
        Write-Host "Waiting $ChromeWaitSeconds seconds for tabs to settle..."
        Start-Sleep -Seconds $ChromeWaitSeconds
    }
    else {
        Write-Host "Skipping Chrome tab launch step."
    }

    Invoke-NodeScript -Path $TwitterScraperPath
    Invoke-NodeScript -Path $EnrichBreakingNewsPath
    Invoke-NodeScript -Path $GetBreakingNewsMediaPath
}

if ($DryRun) {
    Write-Host "Dry run: would execute steps in order:"
    if (-not $SkipChrome) {
        Write-Host " - PowerShell: $OpenChromePath"
        Write-Host " - Wait: $ChromeWaitSeconds seconds"
    } else {
        Write-Host " - Skip Chrome"
    }
    Write-Host " - Node: $TwitterScraperPath"
    Write-Host " - Node: $EnrichBreakingNewsPath"
    Write-Host " - Node: $GetBreakingNewsMediaPath"
    exit 0
}

# Ensure only one instance runs at a time (cross-invocation lock)
$mutexName = 'Global\ProjectNewsMasterLock'
$mutex = New-Object System.Threading.Mutex($false, $mutexName)
$hasHandle = $false

try {
    $hasHandle = $mutex.WaitOne(0)
    if (-not $hasHandle) {
        Write-Host "Another instance is already running. Exiting."
        exit 0
    }

    Push-Location $ScriptRoot
    Run-Sequence
}
finally {
    if ($hasHandle) { $mutex.ReleaseMutex() }
    Pop-Location
}