# 数据库迁移指南

## D1 数据库迁移

本项目使用 Cloudflare D1 数据库，迁移需要通过 Wrangler CLI 执行。

### 1. 生成迁移文件

当修改 `src/schema.ts` 后，运行以下命令生成迁移 SQL：

```bash
pnpm --filter=@starye/db run generate
```

这会在 `packages/db/drizzle/` 目录下生成新的迁移文件。

### 2. 应用迁移

#### 本地开发环境

```bash
cd apps/api
pnpm exec wrangler d1 migrations apply starye-db --local
```

#### 生产环境

```bash
cd apps/api
pnpm exec wrangler d1 migrations apply starye-db --remote
```

**注意：** 生产环境迁移需要配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 环境变量。

### 3. 验证迁移

#### 查看本地数据库

```bash
cd apps/api
pnpm exec wrangler d1 execute starye-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

#### 查看生产数据库

```bash
cd apps/api
pnpm exec wrangler d1 execute starye-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

## Drizzle Studio

如果需要使用 Drizzle Studio 查看远程数据库（需要 D1 HTTP API 凭证）：

1. 设置环境变量：
   ```bash
   export CLOUDFLARE_ACCOUNT_ID="your-account-id"
   export CLOUDFLARE_DATABASE_ID="72b60b6c-806f-4795-a846-9b0d157b8225"
   export CLOUDFLARE_D1_TOKEN="your-api-token"
   ```

2. 启动 Studio：
   ```bash
   pnpm --filter=@starye/db run studio
   ```

## GitHub Actions 自动迁移

生产环境的数据库迁移通过 GitHub Actions 自动执行：
- Workflow: `.github/workflows/deploy-migrations.yml`
- 触发条件：推送到 `main` 分支且 `packages/db/drizzle/` 目录有变更
- 使用 GitHub Secrets 中的 `CLOUDFLARE_API_TOKEN`

## 常见问题

### Q: 为什么 `pnpm --filter=@starye/db run migrate` 会报错？

A: `drizzle-kit migrate` 命令需要 D1 HTTP API 凭证，不适合本地开发。请使用上述的 `wrangler d1 migrations apply` 命令。

### Q: 如何回滚迁移？

A: Wrangler 不支持自动回滚。如果需要回滚，请手动编写反向迁移 SQL 并创建新的迁移文件。

### Q: 迁移文件的命名规则是什么？

A: Drizzle Kit 自动生成格式为 `NNNN_<描述>.sql` 的文件，其中 NNNN 是递增的序号。
