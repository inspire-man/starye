# 数据库迁移指南

## D1 迁移标准流程

本项目使用 Cloudflare D1。生产迁移的正式顺序是：

1. 修改 `packages/db/src/schema.ts`
2. 生成 migration SQL
3. 本地 apply / smoke
4. 生产前做 destructive SQL 检查
5. 远程 apply 前先执行 `wrangler d1 export --remote`
6. 上传 backup 到 R2（并保留 workflow artifact 副本）
7. 再执行 `wrangler d1 migrations apply --remote`
8. apply 后立刻做 schema / API smoke

---

## 1. 生成迁移文件

当修改 `src/schema.ts` 后，运行：

```bash
pnpm --filter=@starye/db run generate
```

输出位置：

- `packages/db/drizzle/*.sql`

---

## 2. 应用迁移

### 本地开发环境

```bash
cd apps/api
pnpm exec wrangler d1 migrations apply starye-db --local
```

### 生产环境

```bash
cd apps/api
pnpm exec wrangler d1 export starye-db --remote --output=../../artifacts/d1-backups/manual-backup.sql
pnpm exec wrangler r2 object put <bucket>/ops/d1-backups/manual-backup.sql --file=../../artifacts/d1-backups/manual-backup.sql --remote
pnpm exec wrangler d1 migrations apply starye-db --remote
```

注意：

- 生产 apply 前必须先备份
- 非交互环境中 `wrangler d1 migrations apply` 会跳过确认，但仍会执行 backup capture
- destructive schema 变更必须先过 reviewer ack gate

---

## 3. Destructive Migration Gate

危险 SQL 至少包括：

- `DROP COLUMN`
- `DROP TABLE`
- `ALTER TABLE ... DROP`

当前 gate 位置：

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-migrations.yml`

如果命中危险 SQL：

1. CI 标记 `requires_ack=true`
2. migration workflow 进入 `production-migration-review` protected environment
3. reviewer 明确 ack 后才允许继续 apply

---

## 4. 验证迁移

### 查看本地数据库

```bash
cd apps/api
pnpm exec wrangler d1 execute starye-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### 查看生产数据库

```bash
cd apps/api
pnpm exec wrangler d1 execute starye-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### 建议的最小 smoke

- 新表 / 新列存在
- 旧表 / 旧索引是否按预期退场
- 关键 API 能正常 query / write
- 前台关键路径能正常读写数据

---

## 5. 恢复路径

### 原则

- 不做自动逆迁移
- 优先 restore 到最近健康点
- 必要时 forward-fix 新 migration

### 主恢复路径

1. 确认故障发生时间点
2. 使用 Cloudflare D1 原生恢复能力：
   - `wrangler d1 time-travel restore ...`
   - 或 Cloudflare 控制台的 restore / time-travel 能力
3. 恢复后立刻做 schema / API smoke

### 备份 SQL 的用途

- workflow 在 apply 前导出 SQL，并上传到 R2
- 同时保留 GitHub Actions artifact 副本
- 该 SQL 用于：
  - 审计
  - 对照
  - 必要时作为手动恢复材料

---

## 6. Drizzle Studio

如需查看远程数据库：

1. 设置环境变量
2. 运行：

```bash
pnpm --filter=@starye/db run studio
```

---

## 7. GitHub Actions 自动迁移

生产环境迁移走：

- `.github/workflows/deploy-migrations.yml`

当前行为：

- 检测 destructive SQL
- 必要时等待 reviewer ack
- 远程 `d1 export`
- 上传 backup 到 R2
- 上传 backup artifact 副本
- 再 `migrations apply`

---

## 8. 常见问题

### Q: 为什么不做自动 rollback migration？

A: D1 schema 回滚风险高，v1 采用“先备份、再 apply、优先 restore / time-travel、必要时 forward-fix”的保守策略。

### Q: 为什么同时保留 R2 与 GitHub artifact？

A: R2 是正式备份落点，满足 DEPLOY-03 的持久化要求；artifact 保留同一份 SQL 的 run-local 副本，便于在 GitHub Actions 页面直接审计和下载。

### Q: migration 失败后第一步做什么？

A: 先停止重复 apply，记录失败 run、R2 object key 与 backup artifact，再决定 restore 还是 forward-fix。
