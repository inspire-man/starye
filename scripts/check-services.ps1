# Service Status Check Script
Write-Host "`n=== Starye Services Status ===" -ForegroundColor Cyan

$services = @{
    "Gateway" = 8080
    "API" = 8787
    "Dashboard" = 5173
    "Blog" = 3002
    "Auth" = 3003
    "Comic" = 3000
    "Movie" = 3001
}

$running = @()
$missing = @()

foreach ($name in $services.Keys) {
    $port = $services[$name]
    $check = netstat -ano | Select-String ":$port " | Select-String "LISTENING"

    if ($check) {
        $pid = ($check -split '\s+')[-1]
        Write-Host "[OK] $name on port $port (PID: $pid)" -ForegroundColor Green
        $running += $name
    } else {
        Write-Host "[!!] $name on port $port - NOT RUNNING" -ForegroundColor Red
        $missing += $name
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Running: $($running.Count)/$($services.Count)" -ForegroundColor $(if ($missing.Count -eq 0) { "Green" } else { "Yellow" })

if ($missing.Count -gt 0) {
    Write-Host "Missing services: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "`nTo fix: Run 'pnpm dev' in terminal" -ForegroundColor Yellow
}

Write-Host ""
