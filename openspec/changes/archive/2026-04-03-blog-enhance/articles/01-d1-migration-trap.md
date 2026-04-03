---
title: Cloudflare D1 迁移的隐藏陷阱：代码部署≠数据库变更
slug: ts-fullstack-ai-01-d1-migration-trap
series: ts-fullstack-ai-chronicle
seriesOrder: 1
tags: ["cloudflare", "d1", "drizzle", "database", "devops"]
excerpt: 明明代码已经部署，API 却一直报 500——原来是 D1 数据库根本没有应用 migration。这篇文章深挖根因，并给出可靠的 CI/CD 修复方案。
---

## 事故现场

某天部署爬虫新逻辑后，API 开始频繁 500。打开 Cloudflare Workers 的日志，看到这样的错误：

```json
{
  "error": "Database Error: Failed query: insert into \"comic\" ...",
  "details": "SqliteError: no such column: is_r18"
}
```

`is_r18`？这个字段明明在代码里加了，Schema 文件里有，Migration 文件也生成了……

但数据库里没有。

## 根因分析

Drizzle ORM 的工作流程是这样的：

```
修改 schema.ts
      ↓
pnpm drizzle-kit generate
      ↓
生成 migrations/0002_xxx.sql
      ↓
提交代码 & 部署 Workers
```

**关键问题**：`git push` + Cloudflare 部署，只是把 Worker 代码推上去了。

那个 `migrations/0002_xxx.sql` 文件？它就安安静静地躺在代码仓库里，**从未被执行**。

Cloudflare D1 不像某些 PaaS 平台会在部署时自动运行 migration。你必须显式告诉它：「嘿，现在请执行这些 SQL 变更。」

错误时序如下：

```
t=0  开发者修改 schema + 生成 migration 文件
t=1  代码部署到 Workers ✅
t=2  Worker 代码尝试写入新字段 is_r18
t=3  D1 数据库结构还是旧的 ❌
t=4  SqliteError: no such column ❌
```

## 解决方案

### 手动修复（紧急）

```powershell
# 应用到远端 D1 数据库
pnpm --filter api exec wrangler d1 migrations apply starye-db --remote
```

执行后，D1 会列出待应用的 migration 并确认，输出类似：

```
Migrations to be applied:
┌──────────────────────────────┐
│ name                         │
├──────────────────────────────┤
│ 0002_add_is_r18_status.sql   │
└──────────────────────────────┘
✅ Applied 1 migration successfully
```

### 根本修复：在 CI/CD 流程中加入 migration 步骤

仅靠「记住手动执行」是靠不住的。正确做法是让 GitHub Actions 在每次部署前自动运行 migration：

```yaml
# .github/workflows/deploy-api.yml
name: Deploy API

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        
      - name: Install dependencies
        run: pnpm install
        
      # 先应用 migration，再部署 Worker
      - name: Apply D1 migrations
        run: pnpm --filter api exec wrangler d1 migrations apply starye-db --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          
      - name: Deploy API Worker
        run: pnpm --filter api deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**顺序很重要**：migration 必须在 deploy 之前。如果 Worker 先上线，在 migration 完成前的那段时间，新代码会访问旧结构，产生同样的错误。

### 本地开发的自动化

本地开发时，`wrangler dev` 会自动应用 local D1 的 migration，所以本地不会遇到这个问题。但这也是陷阱所在——**本地正常 ≠ 生产正常**。

可以在 `package.json` 里加一个 `db:migrate:remote` 脚本，避免每次手打完整命令：

```json
{
  "scripts": {
    "db:migrate:local": "wrangler d1 migrations apply starye-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply starye-db --remote"
  }
}
```

## 经验总结

### Checklist：D1 Schema 变更的正确姿势

- [ ] 修改 `packages/db/src/schema.ts`
- [ ] 运行 `pnpm --filter db generate` 生成 migration 文件
- [ ] 提交 migration SQL 文件（不要忽略）
- [ ] **本地验证**：`pnpm db:migrate:local`，确认本地 D1 正确应用
- [ ] **合并到 main 前**：确保 CI 流程包含 `db:migrate:remote` 步骤
- [ ] 部署完成后，通过 `/api/health` 或简单读取请求验证 schema 已更新

### 核心教训

> **Infrastructure as Code ≠ Auto Sync**
> 
> 代码仓库里的 SQL 文件存在，不代表数据库已经执行了这些变更。迁移脚本需要被显式执行。

这个教训适用于所有类型的数据库迁移工具——Django migrations、Rails migrations、Flyway……任何声明式 schema 管理工具，最终都需要一个显式的「执行」步骤。

在 Cloudflare 这个平台上，这一点更容易被忽视，因为 Workers 部署太顺滑了，容易让人误以为「push 即生效」适用于一切。
