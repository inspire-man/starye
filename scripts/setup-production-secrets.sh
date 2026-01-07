#!/bin/bash

# 生产环境密钥设置脚本
# 使用方法: ./scripts/setup-production-secrets.sh

set -e

echo ""
echo "🔐 Starye API - 生产环境密钥设置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ 错误: wrangler 未安装"
    echo "请运行: npm install -g wrangler"
    exit 1
fi

# 切换到 API 目录
cd "$(dirname "$0")/../apps/api"

echo "📂 当前目录: $(pwd)"
echo ""

# 检查 .dev.vars 文件
if [ ! -f ".dev.vars" ]; then
    echo "❌ 错误: .dev.vars 文件不存在"
    exit 1
fi

echo "📋 将从 .dev.vars 读取密钥值..."
echo ""

# 读取密钥
CRAWLER_SECRET=$(grep "CRAWLER_SECRET" .dev.vars | cut -d'=' -f2 | tr -d '"' | tr -d ' ')
BETTER_AUTH_SECRET=$(grep "BETTER_AUTH_SECRET" .dev.vars | cut -d'=' -f2 | tr -d '"' | tr -d ' ')
GITHUB_CLIENT_ID=$(grep "GITHUB_CLIENT_ID" .dev.vars | cut -d'=' -f2 | tr -d '"' | tr -d ' ')
GITHUB_CLIENT_SECRET=$(grep "GITHUB_CLIENT_SECRET" .dev.vars | cut -d'=' -f2 | tr -d '"' | tr -d ' ')

# 验证必需的密钥
if [ -z "$CRAWLER_SECRET" ]; then
    echo "❌ 错误: CRAWLER_SECRET 未在 .dev.vars 中找到"
    exit 1
fi

if [ -z "$BETTER_AUTH_SECRET" ]; then
    echo "❌ 错误: BETTER_AUTH_SECRET 未在 .dev.vars 中找到"
    exit 1
fi

echo "✅ 找到必需的密钥"
echo "   CRAWLER_SECRET: ${CRAWLER_SECRET:0:20}... (长度: ${#CRAWLER_SECRET})"
echo "   BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:0:20}... (长度: ${#BETTER_AUTH_SECRET})"
echo ""

# 询问是否继续
read -p "是否要设置这些密钥到 Cloudflare Workers? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 0
fi

echo ""
echo "🚀 开始设置密钥..."
echo ""

# 设置 CRAWLER_SECRET
echo "1️⃣ 设置 CRAWLER_SECRET..."
echo "$CRAWLER_SECRET" | wrangler secret put CRAWLER_SECRET
echo "   ✅ CRAWLER_SECRET 已设置"
echo ""

# 设置 BETTER_AUTH_SECRET
echo "2️⃣ 设置 BETTER_AUTH_SECRET..."
echo "$BETTER_AUTH_SECRET" | wrangler secret put BETTER_AUTH_SECRET
echo "   ✅ BETTER_AUTH_SECRET 已设置"
echo ""

# 设置 GitHub OAuth（可选）
if [ -n "$GITHUB_CLIENT_ID" ] && [ -n "$GITHUB_CLIENT_SECRET" ]; then
    read -p "是否也要设置 GitHub OAuth 密钥? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "3️⃣ 设置 GITHUB_CLIENT_ID..."
        echo "$GITHUB_CLIENT_ID" | wrangler secret put GITHUB_CLIENT_ID
        echo "   ✅ GITHUB_CLIENT_ID 已设置"
        echo ""

        echo "4️⃣ 设置 GITHUB_CLIENT_SECRET..."
        echo "$GITHUB_CLIENT_SECRET" | wrangler secret put GITHUB_CLIENT_SECRET
        echo "   ✅ GITHUB_CLIENT_SECRET 已设置"
        echo ""
    fi
fi

# 验证设置
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 已设置的密钥列表:"
echo ""
wrangler secret list
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 密钥设置完成!"
echo ""
echo "📝 下一步:"
echo "   1. 部署 Worker: wrangler deploy"
echo "   2. 测试 API: cd ../../packages/crawler && pnpm test:api"
echo ""

