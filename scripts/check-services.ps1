# Service status diagnostics plus canonical Gateway HTTP readiness.
Write-Host "`n=== Starye Services Status ===" -ForegroundColor Cyan

$services = @(
    [pscustomobject]@{ Name = 'Gateway'; Port = 8080 }
    [pscustomobject]@{ Name = 'API'; Port = 8787 }
    [pscustomobject]@{ Name = 'Dashboard'; Port = 5173 }
    [pscustomobject]@{ Name = 'Quant'; Port = 3004 }
    [pscustomobject]@{ Name = 'Blog'; Port = 3002 }
    [pscustomobject]@{ Name = 'Auth'; Port = 3003 }
    [pscustomobject]@{ Name = 'Comic'; Port = 3000 }
    [pscustomobject]@{ Name = 'Movie'; Port = 3001 }
)

$listeners = @()
foreach ($service in $services) {
    $check = netstat -ano | Select-String ":$($service.Port) " | Select-String 'LISTENING'
    $listening = $null -ne $check
    $listeners += [ordered]@{
        name = $service.Name
        port = $service.Port
        listening = $listening
    }

    if ($listening) {
        $processId = ($check[0] -split '\s+')[-1]
        Write-Host "[OK] $($service.Name) on port $($service.Port) (PID: $processId)" -ForegroundColor Green
    }
    else {
        Write-Host "[!!] $($service.Name) on port $($service.Port) - NOT RUNNING" -ForegroundColor Red
    }
}

$fallbackGateway = [ordered]@{
    schema = 'starye-gateway-readiness-1'
    healthy = $false
    robots = [ordered]@{ outcome = 'fetch_failed' }
    auth = [ordered]@{ outcome = 'fetch_failed' }
    authSlash = [ordered]@{ outcome = 'fetch_failed' }
}
$gateway = $fallbackGateway
$gatewayProbeExitCode = 1

try {
    $gatewayOutput = @(& pnpm --filter @starye/crawler exec node --import tsx ../../scripts/gateway-readiness.ts 2>&1 | ForEach-Object { $_.ToString() })
    $gatewayProbeExitCode = $LASTEXITCODE
    $machineLines = @($gatewayOutput | Where-Object { $_.Trim().StartsWith('{') })
    if ($machineLines.Count -eq 1) {
        $candidate = $machineLines[0] | ConvertFrom-Json
        $outcomesHealthy = $candidate.robots.outcome -eq 'accepted' -and $candidate.auth.outcome -eq 'accepted' -and $candidate.authSlash.outcome -eq 'accepted'
        if ($candidate.schema -eq 'starye-gateway-readiness-1' -and $candidate.healthy -eq $true -and $outcomesHealthy) {
            $gateway = $candidate
        }
        elseif ($candidate.schema -eq 'starye-gateway-readiness-1' -and $null -ne $candidate.robots -and $null -ne $candidate.auth -and $null -ne $candidate.authSlash) {
            $gateway = $candidate
        }
    }
}
catch {
    $gatewayProbeExitCode = 1
}

$listenersHealthy = @($listeners | Where-Object { -not $_.listening }).Count -eq 0
$healthy = $listenersHealthy -and $gatewayProbeExitCode -eq 0 -and $gateway.healthy -eq $true
$combined = [ordered]@{
    schema = 'starye-local-services-1'
    healthy = $healthy
    listeners = @($listeners)
    gateway = $gateway
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Listeners healthy: $listenersHealthy; Gateway HTTP healthy: $($gateway.healthy)" -ForegroundColor $(if ($healthy) { 'Green' } else { 'Yellow' })
Write-Output ($combined | ConvertTo-Json -Compress -Depth 8)

if ($healthy) {
    exit 0
}

exit 1
