# 文档同步脚本 - PowerShell 版本

$DOCS_DIR = "docs"

$LIBS = @{
    "hono"        = "https://hono.dev/llms-full.txt"
    "better-auth" = "https://better-auth.com/llms.txt"
    "nuxt"        = "https://nuxt.com/llms-full.txt"
    "zod"         = "https://zod.dev/llms.txt"
    "vite"        = "https://vite.dev/llms.txt"
    "vitest"      = "https://vitest.dev/llms.txt"
    "vue"         = "https://vuejs.org/llms.txt"
    "turborepo"   = "https://turbo.build/llms.txt"
    "drizzle"     = "https://orm.drizzle.team/llms-full.txt"
}

Write-Host "开始同步文档..."
Write-Host ""

foreach ($lib in $LIBS.Keys) {
    $url = $LIBS[$lib]
    $lib_dir = Join-Path $DOCS_DIR $lib
    $txt_file = Join-Path $lib_dir "llms-full.txt"
    $version_file = Join-Path $lib_dir ".version"
    
    New-Item -ItemType Directory -Force -Path $lib_dir | Out-Null
    
    Write-Host "Syncing $lib..."
    
    try {
        # 下载到临时文件
        $temp_file = [System.IO.Path]::GetTempFileName()
        Invoke-WebRequest -Uri $url -OutFile $temp_file -UseBasicParsing -ErrorAction Stop
        
        # 计算 SHA256 哈希
        $hash = Get-FileHash -Path $temp_file -Algorithm SHA256
        $new_hash = $hash.Hash.ToLower()
        
        # 检查是否需要更新
        $should_update = $true
        if (Test-Path $version_file) {
            $old_version = Get-Content $version_file | ConvertFrom-Json
            if ($old_version.content_hash -eq $new_hash) {
                Write-Host "  ✓ $lib is up to date" -ForegroundColor Green
                Remove-Item $temp_file
                continue
            }
        }
        
        # 更新文件
        Move-Item -Path $temp_file -Destination $txt_file -Force
        
        # 获取文件大小
        $file_size = (Get-Item $txt_file).Length
        
        # 写入版本信息
        $version_data = @{
            source_url     = $url
            downloaded_at  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            content_hash   = $new_hash
            file_size      = $file_size
        }
        
        $version_data | ConvertTo-Json | Set-Content $version_file
        
        Write-Host "  ✓ $lib updated" -ForegroundColor Green
    }
    catch {
        Write-Host "  ✗ Failed to download $lib" -ForegroundColor Red
        Write-Host "  → Please check if the URL is still valid: $url" -ForegroundColor Yellow
        if (Test-Path $temp_file) {
            Remove-Item $temp_file -ErrorAction SilentlyContinue
        }
    }
}

Write-Host ""
Write-Host "Generating metadata..."
node scripts/generate-meta.js

Write-Host "Generating section index..."
node scripts/generate-sections.js

Write-Host ""
Write-Host "✓ Documentation sync complete" -ForegroundColor Green
