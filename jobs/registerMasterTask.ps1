param(
    [string]$TaskName = 'ProjectNewsMaster',
    [int]$IntervalMinutes = 15
)

$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$MasterPath = Join-Path $ScriptRoot 'master.ps1'
if (-not (Test-Path $MasterPath)) { throw "Master script not found: $MasterPath" }

# Use schtasks.exe to create a simple every-15-minutes schedule that's reliable
$taskRun = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $MasterPath + '"'

Write-Host "Creating or updating scheduled task '$TaskName' to run every $IntervalMinutes minutes..."
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    & schtasks.exe /Create /TN $TaskName /SC MINUTE /MO $IntervalMinutes /TR $taskRun /RL HIGHEST /F
} else {
    & schtasks.exe /Create /TN $TaskName /SC MINUTE /MO $IntervalMinutes /TR $taskRun /F
}
if ($LASTEXITCODE -ne 0) { throw "schtasks.exe failed to register the task (exit $LASTEXITCODE)." }
Write-Host "Scheduled task '$TaskName' is configured."