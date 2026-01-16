# URL for your X (Twitter) home timeline
$url = "https://x.com/home"

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

# Launch Chrome with your existing logged-in session
$arguments = @(
    "--remote-debugging-port=$debugPort",
    "--user-data-dir=`"C:\ChromeDebug`"",
    $url
)

Start-Process $chrome -ArgumentList $arguments
