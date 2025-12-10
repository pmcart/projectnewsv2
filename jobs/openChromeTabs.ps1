# List of usernames to open on X.com
$usernames = @(
    "Osinttechnical",
    "bellingcat",
    "sentdefender",
    "WarMonitors",
    "PolymarketIntel",
    "Faytuks",
    "spectatorindex"
)

# Build full URLs
$urls = $usernames | ForEach-Object { "https://x.com/$_" }

# Find Chrome
$chromePaths = @(
    "$Env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$Env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
    Write-Error "Chrome executable not found!"
    exit
}

# DevTools remote-debugging port (for Puppeteer/Playwright)
$debugPort = 9222

# IMPORTANT: no --user-data-dir here, so Chrome uses your existing profile
$arguments = @(
    "--remote-debugging-port=$debugPort --user-data-dir=`"C:\ChromeDebug`""
) + $urls

Start-Process $chrome -ArgumentList $arguments
