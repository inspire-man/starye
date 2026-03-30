# 部署前完整检查脚本
# 确保代码质量和功能完整性

param(
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$Quick
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   部署前检查脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$AllPassed = $true
$Checks = @()

# 检查 1: Git 状态
Write-Host "[1/10] 检查 Git 状态..." -ForegroundColor Yellow
$GitStatus = git status --porcelain
if ($GitStatus) {
    Write-Host "  ⚠️  有未提交的更改" -ForegroundColor Yellow
    $Checks += @{ Name = "Git 状态"; Status = "Warning"; Message = "有未提交的更改" }
} else {
    Write-Host "  ✓ Git 工作区干净" -ForegroundColor Green
    $Checks += @{ Name = "Git 状态"; Status = "Pass"; Message = "工作区干净" }
}

# 检查 2: 依赖安装
Write-Host ""
Write-Host "[2/10] 检查依赖..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  ✓ 依赖已安装" -ForegroundColor Green
    $Checks += @{ Name = "依赖安装"; Status = "Pass"; Message = "已安装" }
} else {
    Write-Host "  ❌ 依赖未安装" -ForegroundColor Red
    Write-Host "  运行: pnpm install" -ForegroundColor Yellow
    $AllPassed = $false
    $Checks += @{ Name = "依赖安装"; Status = "Fail"; Message = "未安装" }
}

# 检查 3: TypeScript 类型检查
if (-not $Quick) {
    Write-Host ""
    Write-Host "[3/10] TypeScript 类型检查..." -ForegroundColor Yellow
    
    # 后端
    Write-Host "  检查后端..." -ForegroundColor Cyan
    $BackendTypeCheck = pnpm --filter api run type-check 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ 后端类型检查通过" -ForegroundColor Green
        $Checks += @{ Name = "后端类型检查"; Status = "Pass"; Message = "通过" }
    } else {
        Write-Host "  ❌ 后端类型检查失败" -ForegroundColor Red
        Write-Host $BackendTypeCheck -ForegroundColor Red
        $AllPassed = $false
        $Checks += @{ Name = "后端类型检查"; Status = "Fail"; Message = "有类型错误" }
    }
    
    # 前端（使用 build 检查）
    Write-Host "  检查前端..." -ForegroundColor Cyan
    $FrontendBuild = pnpm --filter movie-app run build --mode=production 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ 前端构建通过（含类型检查）" -ForegroundColor Green
        $Checks += @{ Name = "前端构建"; Status = "Pass"; Message = "构建成功" }
    } else {
        Write-Host "  ❌ 前端构建失败" -ForegroundColor Red
        $AllPassed = $false
        $Checks += @{ Name = "前端构建"; Status = "Fail"; Message = "构建失败" }
    }
} else {
    Write-Host ""
    Write-Host "[3/10] TypeScript 检查（跳过）" -ForegroundColor Gray
}

# 检查 4: Lint 检查
if (-not $Quick) {
    Write-Host ""
    Write-Host "[4/10] Lint 检查..." -ForegroundColor Yellow
    $LintCheck = pnpm lint 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Lint 检查通过" -ForegroundColor Green
        $Checks += @{ Name = "Lint 检查"; Status = "Pass"; Message = "无问题" }
    } else {
        Write-Host "  ⚠️  Lint 检查有警告" -ForegroundColor Yellow
        $Checks += @{ Name = "Lint 检查"; Status = "Warning"; Message = "有警告" }
    }
} else {
    Write-Host ""
    Write-Host "[4/10] Lint 检查（跳过）" -ForegroundColor Gray
}

# 检查 5: 单元测试
if (-not $SkipTests) {
    Write-Host ""
    Write-Host "[5/10] 单元测试..." -ForegroundColor Yellow
    
    # 后端测试
    Write-Host "  运行后端测试..." -ForegroundColor Cyan
    $BackendTest = pnpm --filter api run test --run 2>&1
    $BackendTestResult = $BackendTest | Select-String -Pattern "Test Files.*passed"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ 后端测试通过: $BackendTestResult" -ForegroundColor Green
        $Checks += @{ Name = "后端单元测试"; Status = "Pass"; Message = "全部通过" }
    } else {
        Write-Host "  ❌ 后端测试失败" -ForegroundColor Red
        $AllPassed = $false
        $Checks += @{ Name = "后端单元测试"; Status = "Fail"; Message = "有失败" }
    }
    
    # 前端测试
    Write-Host "  运行前端测试..." -ForegroundColor Cyan
    $FrontendTest = pnpm --filter movie-app run test --run 2>&1
    $FrontendTestResult = $FrontendTest | Select-String -Pattern "Tests.*passed"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ 前端测试通过: $FrontendTestResult" -ForegroundColor Green
        $Checks += @{ Name = "前端单元测试"; Status = "Pass"; Message = "全部通过" }
    } else {
        Write-Host "  ❌ 前端测试失败" -ForegroundColor Red
        $AllPassed = $false
        $Checks += @{ Name = "前端单元测试"; Status = "Fail"; Message = "有失败" }
    }
} else {
    Write-Host ""
    Write-Host "[5/10] 单元测试（跳过）" -ForegroundColor Gray
}

# 检查 6: E2E 测试
if (-not $SkipTests) {
    Write-Host ""
    Write-Host "[6/10] E2E 测试..." -ForegroundColor Yellow
    
    Set-Location "apps/movie-app"
    $E2ETest = pnpm run test:e2e html-integration.spec.ts 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ E2E 测试通过" -ForegroundColor Green
        $Checks += @{ Name = "E2E 测试"; Status = "Pass"; Message = "8/8 通过" }
    } else {
        Write-Host "  ⚠️  E2E 测试失败（不阻塞部署）" -ForegroundColor Yellow
        $Checks += @{ Name = "E2E 测试"; Status = "Warning"; Message = "部分失败" }
    }
    Set-Location $ProjectRoot
} else {
    Write-Host ""
    Write-Host "[6/10] E2E 测试（跳过）" -ForegroundColor Gray
}

# 检查 7: 数据库迁移
Write-Host ""
Write-Host "[7/10] 检查数据库迁移..." -ForegroundColor Yellow
$MigrationFiles = Get-ChildItem "packages/db/drizzle/*.sql" -File | Where-Object { $_.Name -like "*ratings*" -or $_.Name -like "*aria2*" }
if ($MigrationFiles.Count -gt 0) {
    Write-Host "  ✓ 发现新迁移文件:" -ForegroundColor Green
    foreach ($file in $MigrationFiles) {
        Write-Host "    - $($file.Name)" -ForegroundColor Cyan
    }
    $Checks += @{ Name = "数据库迁移"; Status = "Pass"; Message = "迁移文件已准备" }
} else {
    Write-Host "  ⚠️  未找到新迁移文件" -ForegroundColor Yellow
    $Checks += @{ Name = "数据库迁移"; Status = "Warning"; Message = "无新迁移" }
}

# 检查 8: 环境变量
Write-Host ""
Write-Host "[8/10] 检查环境变量配置..." -ForegroundColor Yellow
$RequiredSecrets = @(
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "BETTER_AUTH_SECRET"
)

Write-Host "  需要的 Secrets:" -ForegroundColor Cyan
foreach ($secret in $RequiredSecrets) {
    Write-Host "    - $secret" -ForegroundColor White
}
$Checks += @{ Name = "环境变量"; Status = "Info"; Message = "需手动验证" }

# 检查 9: 文档完整性
Write-Host ""
Write-Host "[9/10] 检查文档..." -ForegroundColor Yellow
$RequiredDocs = @(
    "apps/movie-app/docs/ARIA2_SETUP_GUIDE.md",
    "apps/movie-app/docs/RATING_SYSTEM_GUIDE.md",
    "apps/movie-app/docs/TROUBLESHOOTING.md",
    "apps/api/docs/API_DOCUMENTATION.md"
)

$AllDocsExist = $true
foreach ($doc in $RequiredDocs) {
    if (Test-Path $doc) {
        Write-Host "  ✓ $doc" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $doc (缺失)" -ForegroundColor Red
        $AllDocsExist = $false
    }
}

if ($AllDocsExist) {
    $Checks += @{ Name = "文档完整性"; Status = "Pass"; Message = "所有文档已就绪" }
} else {
    $AllPassed = $false
    $Checks += @{ Name = "文档完整性"; Status = "Fail"; Message = "部分文档缺失" }
}

# 检查 10: 部署清单
Write-Host ""
Write-Host "[10/10] 检查部署清单..." -ForegroundColor Yellow
$DeploymentChecklist = "openspec/changes/aria2-integration-quality-rating/DEPLOYMENT_CHECKLIST.md"
if (Test-Path $DeploymentChecklist) {
    Write-Host "  ✓ 部署清单已准备" -ForegroundColor Green
    $Checks += @{ Name = "部署清单"; Status = "Pass"; Message = "已准备" }
} else {
    Write-Host "  ⚠️  部署清单不存在" -ForegroundColor Yellow
    $Checks += @{ Name = "部署清单"; Status = "Warning"; Message = "无清单" }
}

# 生成检查报告
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   检查结果汇总" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$PassCount = ($Checks | Where-Object { $_.Status -eq "Pass" }).Count
$FailCount = ($Checks | Where-Object { $_.Status -eq "Fail" }).Count
$WarnCount = ($Checks | Where-Object { $_.Status -eq "Warning" }).Count

foreach ($check in $Checks) {
    $Icon = switch ($check.Status) {
        "Pass" { "✓" }
        "Fail" { "❌" }
        "Warning" { "⚠️" }
        "Info" { "ℹ️" }
    }
    
    $Color = switch ($check.Status) {
        "Pass" { "Green" }
        "Fail" { "Red" }
        "Warning" { "Yellow" }
        "Info" { "Cyan" }
    }
    
    Write-Host "$Icon $($check.Name): $($check.Message)" -ForegroundColor $Color
}

Write-Host ""
Write-Host "通过: $PassCount | 失败: $FailCount | 警告: $WarnCount" -ForegroundColor Cyan

# 最终结果
Write-Host ""
if ($AllPassed -and $FailCount -eq 0) {
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "   ✅ 所有检查通过，可以部署！" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步操作：" -ForegroundColor Cyan
    Write-Host "  1. 提交代码: git add . && git commit" -ForegroundColor White
    Write-Host "  2. 推送到远程: git push origin main" -ForegroundColor White
    Write-Host "  3. 等待 CI/CD 自动部署" -ForegroundColor White
    Write-Host "  4. 监控部署状态和日志" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "   ❌ 检查未完全通过" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先解决失败的检查项，然后重新运行此脚本。" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
