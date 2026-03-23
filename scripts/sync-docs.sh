#!/bin/bash

# 文档同步脚本 - 从官方源下载 llms.txt 文档

DOCS_DIR="docs"

# 定义框架 URL 映射
declare -A LIBS=(
  ["hono"]="https://hono.dev/llms-full.txt"
  ["better-auth"]="https://better-auth.com/llms.txt"
  ["nuxt"]="https://nuxt.com/llms-full.txt"
  ["zod"]="https://zod.dev/llms.txt"
  ["vite"]="https://vite.dev/llms.txt"
  ["vitest"]="https://vitest.dev/llms.txt"
  ["vue"]="https://vuejs.org/llms.txt"
  ["turborepo"]="https://turbo.build/llms.txt"
  ["drizzle"]="https://orm.drizzle.team/llms-full.txt"
)

echo "开始同步文档..."
echo ""

for lib in "${!LIBS[@]}"; do
  url="${LIBS[$lib]}"
  lib_dir="$DOCS_DIR/$lib"
  txt_file="$lib_dir/llms-full.txt"
  version_file="$lib_dir/.version"
  
  mkdir -p "$lib_dir"
  
  echo "Syncing $lib..."
  
  # 下载到临时文件
  temp_file=$(mktemp)
  if curl -s -f "$url" > "$temp_file" 2>/dev/null; then
    # 计算 SHA256 哈希
    if command -v sha256sum &> /dev/null; then
      new_hash=$(sha256sum "$temp_file" | cut -d' ' -f1)
    elif command -v shasum &> /dev/null; then
      new_hash=$(shasum -a 256 "$temp_file" | cut -d' ' -f1)
    else
      echo "  ✗ 错误: 找不到 sha256sum 或 shasum 命令"
      rm "$temp_file"
      continue
    fi
    
    # 检查是否需要更新
    if [ -f "$version_file" ]; then
      old_hash=$(grep -o '"content_hash": "[^"]*"' "$version_file" | sed 's/"content_hash": "\(.*\)"/\1/')
      if [ "$new_hash" = "$old_hash" ]; then
        echo "  ✓ $lib is up to date"
        rm "$temp_file"
        continue
      fi
    fi
    
    # 更新文件
    mv "$temp_file" "$txt_file"
    
    # 获取文件大小
    if [ "$(uname)" = "Darwin" ]; then
      file_size=$(stat -f%z "$txt_file")
    else
      file_size=$(stat -c%s "$txt_file" 2>/dev/null || wc -c < "$txt_file")
    fi
    
    # 写入版本信息
    cat > "$version_file" <<EOF
{
  "source_url": "$url",
  "downloaded_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "content_hash": "$new_hash",
  "file_size": $file_size
}
EOF
    
    echo "  ✓ $lib updated"
  else
    echo "  ✗ Failed to download $lib"
    echo "  → Please check if the URL is still valid: $url"
    rm "$temp_file" 2>/dev/null
  fi
done

echo ""
echo "Generating metadata..."
node scripts/generate-meta.js

echo "Generating section index..."
node scripts/generate-sections.js

echo ""
echo "✓ Documentation sync complete"
