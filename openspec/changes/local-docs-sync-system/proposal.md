## Why

在使用 AI 辅助开发时，需要快速、准确地查询项目所用技术栈（Hono、Nuxt、Zod、Drizzle ORM 等）的官方文档。当前缺乏统一的文档管理机制，导致 AI 每次都需要通过 WebSearch 查询，响应慢（5-10秒）且结果不稳定。许多现代框架已提供 LLMs 友好的文档格式（llms.txt），但需要建立本地同步机制，使 AI 能在 1 秒内精确定位相关文档章节。

## What Changes

- **新增文档同步脚本**：创建 `scripts/sync-docs.sh` 自动从官方源下载 llms.txt 文档
- **新增文档索引生成**：创建 `scripts/generate-meta.js` 和 `scripts/generate-sections.js` 自动生成元数据和章节索引
- **新增文档存储结构**：在 `docs/` 下按框架组织文档（如 `docs/hono/llms-full.txt`）
- **新增版本跟踪**：每个文档目录包含 `.version` 文件记录下载时间和内容哈希
- **更新 .cursorrules**：添加 AI 文档查找策略，定义优先级和查找流程
- **新增 package.json 脚本**：添加 `docs:sync`、`docs:meta`、`docs:index` 命令
- **新增文档列表**：支持 Hono、Better Auth、Nuxt、Zod、Vite、Vitest、Vue、Turborepo、Drizzle ORM 共 9 个技术栈

此变更 MUST 确保文档同步过程完全自动化，无需手动维护索引文件。

## Capabilities

### New Capabilities

- `docs-sync`: 从官方源自动同步 llms.txt 文档到本地，包含版本跟踪和增量更新能力
- `docs-indexing`: 自动扫描本地文档生成元数据索引（_meta.json）和章节索引（_sections.json），支持快速定位
- `ai-docs-strategy`: 为 AI 提供文档查找策略，包括快速路径（章节索引）、降级路径（Grep 搜索）和兜底路径（WebSearch）

### Modified Capabilities

<!-- 无现有能力需要修改 -->

## Impact

- **新增文件**：
  - `scripts/sync-docs.sh` - Bash 同步脚本
  - `scripts/generate-meta.js` - Node.js 元数据生成脚本
  - `scripts/generate-sections.js` - Node.js 章节索引生成脚本
  - `docs/{framework}/llms-full.txt` - 各框架文档（9个）
  - `docs/{framework}/.version` - 版本跟踪文件（9个）
  - `docs/_meta.json` - 元数据索引
  - `docs/_sections.json` - 章节索引

- **修改文件**：
  - `package.json` - 添加文档同步相关脚本
  - `.cursorrules` - 添加 AI 文档查找策略
  - `.gitignore` - 排除 `docs/*/.version`（可选）

- **删除文件**：
  - `docs/*-reference.md` - 旧的目录式文档（8个），可选择归档或删除

- **依赖变化**：无新增外部依赖，使用 Node.js 内置模块和 curl

- **性能影响**：
  - 文档查询从 5-10 秒（WebSearch）降至 < 1 秒（本地 Grep + Read）
  - 磁盘占用增加约 2-3MB（9 个框架的完整文档）
  - 首次同步耗时约 30-60 秒（下载 + 索引生成）

- **开发流程影响**：
  - 开发者需定期运行 `pnpm docs:sync`（建议每周一次）
  - AI 助手将自动使用本地文档，无需额外配置
