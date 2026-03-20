# Port Cleanup Script
# Kills processes occupying development server ports

param(
    [switch]$Force,
    [switch]$Verbose
)

Write-Host "`n=== Starye Port Cleanup ===" -ForegroundColor Cyan

# Define all ports used by development services
$ports = @{
    "Gateway" = 8080
    "API" = 8787
    "Dashboard" = 5173
    "Blog" = 3002
    "Auth" = 3003
    "Comic" = 3000
    "Movie" = 3001
}

$cleaned = @()
$skipped = @()

foreach ($name in $ports.Keys) {
    $port = $ports[$name]

    # Check if port is in use
    $connections = netstat -ano | Select-String ":$port " | Select-String "LISTENING"

    if ($connections) {
        # Extract PID from netstat output
        $processId = ($connections -split '\s+')[-1]

        # Get process info
        try {
            $process = Get-Process -Id $processId -ErrorAction Stop
            $processName = $process.ProcessName

            Write-Host "`n[FOUND] $name on port $port" -ForegroundColor Yellow
            Write-Host "  Process: $processName (PID: $processId)" -ForegroundColor Gray

            if ($Verbose) {
                Write-Host "  Path: $($process.Path)" -ForegroundColor DarkGray
            }

            # Ask for confirmation unless -Force is specified
            if (-not $Force) {
                $response = Read-Host "  Kill this process? (y/N)"
                if ($response -ne 'y' -and $response -ne 'Y') {
                    Write-Host "  Skipped." -ForegroundColor DarkGray
                    $skipped += $name
                    continue
                }
            }

            # Kill the process
            try {
                Stop-Process -Id $processId -Force -ErrorAction Stop
                Write-Host "  [OK] Process terminated" -ForegroundColor Green
                $cleaned += $name
                Start-Sleep -Milliseconds 500  # Brief pause to let port release
            }
            catch {
                Write-Host "  [ERROR] Failed to kill process: $_" -ForegroundColor Red
                $skipped += $name
            }
        }
        catch {
            Write-Host "`n[FOUND] Process on port $port (PID: $processId)" -ForegroundColor Yellow
            Write-Host "  [WARNING] Cannot get process info, attempting to kill..." -ForegroundColor Yellow

            if (-not $Force) {
                $response = Read-Host "  Kill PID $processId? (y/N)"
                if ($response -ne 'y' -and $response -ne 'Y') {
                    Write-Host "  Skipped." -ForegroundColor DarkGray
                    $skipped += $name
                    continue
                }
            }

            try {
                taskkill /F /PID $processId 2>&1 | Out-Null
                Write-Host "  [OK] Process terminated" -ForegroundColor Green
                $cleaned += $name
                Start-Sleep -Milliseconds 500
            }
            catch {
                Write-Host "  [ERROR] Failed to kill process" -ForegroundColor Red
                $skipped += $name
            }
        }
    }
    else {
        if ($Verbose) {
            Write-Host "[FREE] $name port $port is available" -ForegroundColor DarkGray
        }
    }
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan

if ($cleaned.Count -gt 0) {
    Write-Host "Cleaned $($cleaned.Count) port(s): $($cleaned -join ', ')" -ForegroundColor Green
}

if ($skipped.Count -gt 0) {
    Write-Host "Skipped $($skipped.Count) port(s): $($skipped -join ', ')" -ForegroundColor Yellow
}

if ($cleaned.Count -eq 0 -and $skipped.Count -eq 0) {
    Write-Host "All ports are clean!" -ForegroundColor Green
}

Write-Host "`nYou can now run: pnpm dev" -ForegroundColor Cyan
Write-Host ""
