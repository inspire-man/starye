# 数据库 Schema 验证脚本
# 验证 aria2-integration-quality-rating 变更的数据库迁移

$db = "starye-db"
$failed = $false

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "数据库 Schema 验证" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 验证表存在
Write-Host "1. 验证表是否存在..." -ForegroundColor Yellow
$tables = pnpm exec wrangler d1 execute $db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ratings', 'aria2_configs')" 2>&1 | Out-String

if ($tables -match "ratings" -and $tables -match "aria2_configs") {
    Write-Host "   ✓ ratings 表存在" -ForegroundColor Green
    Write-Host "   ✓ aria2_configs 表存在" -ForegroundColor Green
} else {
    Write-Host "   ✗ 缺少必要的表" -ForegroundColor Red
    $failed = $true
}

# 验证 ratings 表结构
Write-Host "`n2. 验证 ratings 表结构..." -ForegroundColor Yellow
$ratingsInfo = pnpm exec wrangler d1 execute $db --local --command "PRAGMA table_info(ratings)" 2>&1 | Out-String

$requiredFields = @("id", "player_id", "user_id", "score", "created_at", "updated_at")
$allFieldsPresent = $true

foreach ($field in $requiredFields) {
    if ($ratingsInfo -match $field) {
        Write-Host "   ✓ $field 字段存在" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $field 字段缺失" -ForegroundColor Red
        $allFieldsPresent = $false
        $failed = $true
    }
}

# 验证 aria2_configs 表结构
Write-Host "`n3. 验证 aria2_configs 表结构..." -ForegroundColor Yellow
$aria2Info = pnpm exec wrangler d1 execute $db --local --command "PRAGMA table_info(aria2_configs)" 2>&1 | Out-String

$requiredFields = @("id", "user_id", "rpc_url", "secret_encrypted", "use_proxy", "created_at", "updated_at")
$allFieldsPresent = $true

foreach ($field in $requiredFields) {
    if ($aria2Info -match $field) {
        Write-Host "   ✓ $field 字段存在" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $field 字段缺失" -ForegroundColor Red
        $allFieldsPresent = $false
        $failed = $true
    }
}

# 验证 player 表新字段
Write-Host "`n4. 验证 player 表新字段..." -ForegroundColor Yellow
$playerInfo = pnpm exec wrangler d1 execute $db --local --command "PRAGMA table_info(player)" 2>&1 | Out-String

if ($playerInfo -match "average_rating") {
    Write-Host "   ✓ average_rating 字段存在" -ForegroundColor Green
} else {
    Write-Host "   ✗ average_rating 字段缺失" -ForegroundColor Red
    $failed = $true
}

if ($playerInfo -match "rating_count") {
    Write-Host "   ✓ rating_count 字段存在" -ForegroundColor Green
} else {
    Write-Host "   ✗ rating_count 字段缺失" -ForegroundColor Red
    $failed = $true
}

# 验证索引
Write-Host "`n5. 验证索引..." -ForegroundColor Yellow
$indexes = pnpm exec wrangler d1 execute $db --local --command "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('ratings', 'player')" 2>&1 | Out-String

if ($indexes -match "idx_ratings_player_user") {
    Write-Host "   ✓ idx_ratings_player_user 索引存在" -ForegroundColor Green
} else {
    Write-Host "   ✗ idx_ratings_player_user 索引缺失" -ForegroundColor Red
    $failed = $true
}

if ($indexes -match "idx_player_rating") {
    Write-Host "   ✓ idx_player_rating 索引存在" -ForegroundColor Green
} else {
    Write-Host "   ✗ idx_player_rating 索引缺失" -ForegroundColor Red
    $failed = $true
}

# 验证迁移记录
Write-Host "`n6. 验证迁移记录..." -ForegroundColor Yellow
$migrations = pnpm exec wrangler d1 execute $db --local --command "SELECT name FROM d1_migrations ORDER BY applied_at DESC LIMIT 5" 2>&1 | Out-String

Write-Host "   最近的迁移记录：" -ForegroundColor Gray
Write-Host $migrations -ForegroundColor Gray

# 测试数据插入（可选）
Write-Host "`n7. 测试数据操作..." -ForegroundColor Yellow
$testInsert = pnpm exec wrangler d1 execute $db --local --command "SELECT COUNT(*) as count FROM ratings" 2>&1 | Out-String

if ($testInsert -match "count") {
    Write-Host "   ✓ 可以查询 ratings 表" -ForegroundColor Green
} else {
    Write-Host "   ✗ 无法查询 ratings 表" -ForegroundColor Red
    $failed = $true
}

$testInsert = pnpm exec wrangler d1 execute $db --local --command "SELECT COUNT(*) as count FROM aria2_configs" 2>&1 | Out-String

if ($testInsert -match "count") {
    Write-Host "   ✓ 可以查询 aria2_configs 表" -ForegroundColor Green
} else {
    Write-Host "   ✗ 无法查询 aria2_configs 表" -ForegroundColor Red
    $failed = $true
}

# 总结
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($failed) {
    Write-Host "验证失败" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
else {
    Write-Host "验证成功" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}
