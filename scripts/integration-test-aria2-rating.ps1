# Aria2 集成和评分系统集成测试脚本
# 用途：自动化验证 Aria2 集成和评分系统功能

param(
    [switch]$SkipAria2,  # 跳过 Aria2 测试
    [switch]$SkipRating  # 跳过评分测试
)

$ErrorActionPreference = "Continue"

Write-Host "=== Aria2 集成和评分系统集成测试 ===" -ForegroundColor Cyan
Write-Host ""

# 测试结果统计
$script:PassCount = 0
$script:FailCount = 0
$script:SkipCount = 0

function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$Action,
        [switch]$Manual
    )
    
    Write-Host "测试: $Name" -ForegroundColor Yellow
    
    if ($Manual) {
        Write-Host "  [手动] 请手动验证此步骤" -ForegroundColor Magenta
        $script:SkipCount++
        return
    }
    
    try {
        & $Action
        Write-Host "  [✓] 通过" -ForegroundColor Green
        $script:PassCount++
    }
    catch {
        Write-Host "  [✗] 失败: $_" -ForegroundColor Red
        $script:FailCount++
    }
    Write-Host ""
}

# ============================================
# 第 1 部分: 环境检查
# ============================================
Write-Host "--- 第 1 部分: 环境检查 ---" -ForegroundColor Cyan

Test-Step "检查 Node.js 版本" {
    $nodeVersion = node --version
    if (-not $nodeVersion) {
        throw "Node.js 未安装"
    }
    Write-Host "  Node.js 版本: $nodeVersion" -ForegroundColor Gray
}

Test-Step "检查 pnpm 版本" {
    $pnpmVersion = pnpm --version
    if (-not $pnpmVersion) {
        throw "pnpm 未安装"
    }
    Write-Host "  pnpm 版本: $pnpmVersion" -ForegroundColor Gray
}

Test-Step "检查本地数据库" {
    $dbPath = "apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"
    if (-not (Test-Path $dbPath)) {
        throw "本地数据库不存在，请先运行: pnpm --filter api run db:migrate:local"
    }
}

# ============================================
# 第 2 部分: Aria2 集成测试
# ============================================
if (-not $SkipAria2) {
    Write-Host "--- 第 2 部分: Aria2 集成测试 ---" -ForegroundColor Cyan
    
    Test-Step "25.1 检查 Aria2 服务" {
        # 尝试连接到默认 Aria2 RPC 地址
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:6800/jsonrpc" -Method POST -ContentType "application/json" -Body '{"jsonrpc":"2.0","id":"test","method":"aria2.getVersion"}' -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                Write-Host "  Aria2 服务运行中" -ForegroundColor Gray
            }
        }
        catch {
            Write-Host "  Aria2 服务未运行" -ForegroundColor Yellow
            Write-Host "  请手动启动: aria2c --enable-rpc --rpc-listen-all" -ForegroundColor Yellow
            throw "Aria2 服务未运行"
        }
    }
    
    Test-Step "25.2 测试 Aria2 连接配置" -Manual
    Test-Step "25.3 测试添加磁链" -Manual
    Test-Step "25.4 验证任务下载" -Manual
    Test-Step "25.5 测试任务控制（暂停/恢复/删除）" -Manual
    Test-Step "25.6 测试 WebSocket 实时进度" -Manual
    Test-Step "25.7 测试降级逻辑" -Manual
    Test-Step "25.8 测试批量添加任务" -Manual
}

# ============================================
# 第 3 部分: 评分系统集成测试
# ============================================
if (-not $SkipRating) {
    Write-Host "--- 第 3 部分: 评分系统集成测试 ---" -ForegroundColor Cyan
    
    Test-Step "26.1 测试评分提交" -Manual
    Test-Step "26.2 验证评分显示" -Manual
    Test-Step "26.3 测试修改评分" -Manual
    Test-Step "26.4 测试评分分布图表" -Manual
    Test-Step "26.5 测试 Top 评分列表" -Manual
    Test-Step "26.6 测试频率限制" -Manual
    Test-Step "26.7 测试未登录评分" -Manual
}

# ============================================
# 第 4 部分: API 端点测试
# ============================================
Write-Host "--- 第 4 部分: API 端点测试 ---" -ForegroundColor Cyan

Test-Step "测试评分 API 端点" {
    # 这里应该启动 API 服务并测试端点
    # 由于需要实际的 API 服务运行，标记为手动测试
    throw "需要 API 服务运行，请手动测试"
}

# ============================================
# 测试总结
# ============================================
Write-Host ""
Write-Host "=== 测试总结 ===" -ForegroundColor Cyan
Write-Host "通过: $script:PassCount" -ForegroundColor Green
Write-Host "失败: $script:FailCount" -ForegroundColor Red
Write-Host "跳过: $script:SkipCount" -ForegroundColor Yellow
Write-Host ""

if ($script:FailCount -gt 0) {
    Write-Host "存在失败的测试，请检查" -ForegroundColor Red
    exit 1
}
else {
    Write-Host "所有自动化测试通过！" -ForegroundColor Green
    if ($script:SkipCount -gt 0) {
        Write-Host "注意: 有 $script:SkipCount 个手动测试需要验证" -ForegroundColor Yellow
    }
    exit 0
}
