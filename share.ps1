# Share Rekha on a public HTTPS link from this laptop.
#
#   cd E:\rekha
#   powershell -ExecutionPolicy Bypass -File share.ps1                       # picks a tunnel that works here
#   powershell -ExecutionPolicy Bypass -File share.ps1 -Tunnel pinggy        # force one: pinggy | cloudflare | ngrok
#   powershell -ExecutionPolicy Bypass -File share.ps1 -Tunnel ngrok -Domain your-name.ngrok-free.app
#
# Tunnels (all free):
#   cloudflare  no account; needs outbound TCP/UDP port 7844 (blocked on many campus networks)
#   pinggy      no account; works over port 443; free links last 60 minutes, then run again
#   ngrok       free account + one permanent link; works over port 443
#
# Keep this window open and the laptop awake. Ctrl+C stops the tunnel and Rekha.
param(
  [int]$Port = 8010,
  [ValidateSet('auto', 'cloudflare', 'pinggy', 'ngrok')][string]$Tunnel = 'auto',
  [string]$Domain = ''
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not (Test-Path "$root\backend\.env")) { throw "backend\.env is missing: copy backend\.env.example to backend\.env and set the passwords." }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port is busy. Use: share.ps1 -Port 8020" }

function Test-Tcp($hostName, $port) {
  $c = New-Object Net.Sockets.TcpClient
  try { return $c.ConnectAsync($hostName, $port).Wait(4000) } catch { return $false } finally { $c.Dispose() }
}

if ($Tunnel -eq 'auto') {
  $Tunnel = if (Test-Tcp 'region1.v2.argotunnel.com' 7844) { 'cloudflare' } else { 'pinggy' }
  Write-Host "==> Using $Tunnel tunnel" -ForegroundColor Cyan
}

Write-Host "==> Building the website" -ForegroundColor Cyan
Push-Location "$root\frontend"; npm run build; Pop-Location

Write-Host "==> Starting Rekha on http://127.0.0.1:$Port (site + API on one port)" -ForegroundColor Cyan
$env:REKHA_STATIC = "$root\frontend\dist"
# 127.0.0.1 only: reachable through the tunnel, not from your Wi-Fi network.
# --proxy-headers: trust X-Forwarded-For from the local tunnel so login rate limiting sees real visitor IPs.
$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory "$root\backend" `
  -FilePath "$root\backend\.venv\Scripts\python.exe" `
  -ArgumentList "-m uvicorn app:app --host 127.0.0.1 --port $Port --env-file .env --proxy-headers --forwarded-allow-ips 127.0.0.1"
try {
  for ($i = 0; $i -lt 30; $i++) {
    try { Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/api/health" -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep 1 }
  }
  switch ($Tunnel) {
    'cloudflare' {
      $cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
      if (-not $cf) { $cf = "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe" }
      Write-Host "==> Your link is the https://...trycloudflare.com line below." -ForegroundColor Cyan
      & $cf tunnel --no-autoupdate --protocol http2 --url "http://127.0.0.1:$Port"
    }
    'pinggy' {
      Write-Host "==> Your link is the https://...pinggy.link line below. If asked for a password, just press Enter." -ForegroundColor Cyan
      & ssh -p 443 -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -R0:127.0.0.1:$Port a.pinggy.io
    }
    'ngrok' {
      if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) { throw "Install ngrok: winget install ngrok.ngrok, then: ngrok config add-authtoken <token from dashboard.ngrok.com>" }
      if ($Domain) { & ngrok http --url "https://$Domain" "127.0.0.1:$Port" } else { & ngrok http "127.0.0.1:$Port" }
    }
  }
} finally {
  Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
  Write-Host "Rekha stopped."
}
