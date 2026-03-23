## Context

当前项目使用了多个现代技术栈（Hono、Nuxt、Zod、Drizzle ORM 等），这些框架大多提供了 LLMs 友好的文档格式（llms.txt 或 llms-full.txt）。然而，项目中现有的 `docs/*-reference.md` 文件仅包含文档链接目录，AI 无法直接读取内容，只能通过 WebSearch 查询，导致响应慢且结果不稳定。

本设计旨在建立一套自动化的本地文档同步系统，使 AI 能够快速、精确地访问官方文档内容。系统需要考虑以下约束：
- **跨平台兼容性**：脚本需在 Windows (PowerShell) 和类 Unix 系统上运行
- **零维护成本**：索引文件应自动生成，无需手动编辑
- **增量更新**：避免重复下载未变化的文档
- **可扩展性**：方便添加新的技术栈文档

## Goals / Non-Goals

**Goals:**
- 提供自动化的文档同步机制，支持 9 个核心技术栈
- 生成章节索引，使 AI 能在 1 秒内定位相关章节
- 实现版本跟踪，支持增量更新
- 通过 .cursorrules 为 AI 提供清晰的文档查找策略
- 完全自动化，无需手动维护配置文件

**Non-Goals:**
- 不实现实时文档同步（使用定期手动同步即可）
- 不构建复杂的 MCP Server（Phase 1 仅本地文件）
- 不支持没有 llms.txt 的技术栈（如 Tailwind CSS）
- 不实现 AI Embeddings 语义搜索（可作为 Phase 2）
- 不对文档内容进行二次加工或翻译

## Decisions

### 决策 1: 文档存储结构

**选择**: 按框架组织的扁平目录结构

```
docs/
├── _meta.json              # 元数据索引
├── _sections.json          # 章节索引
├── hono/
│   ├── llms-full.txt
│   └── .version
├── drizzle/
│   ├── llms-full.txt
│   └── .version
└── ...
```

**理由**:
- 扁平结构便于 AI 工具直接访问（如 `docs/hono/llms-full.txt`）
- 每个框架独立目录，方便管理和更新
- `.version` 文件与文档放在同一目录，便于跟踪

**备选方案**: 将所有文档放在 `docs/frameworks/` 子目录
- 劣势：路径更长，不直观
- 优势：更清晰的分类（但当前不需要）

### 决策 2: 同步脚本语言选择

**选择**: Bash 脚本 + Node.js 脚本混合

- `sync-docs.sh`: Bash 脚本，负责下载文档和生成版本信息
- `generate-meta.js`: Node.js 脚本，生成元数据索引
- `generate-sections.js`: Node.js 脚本，扫描文档生成章节索引

**理由**:
- Bash 适合文件操作和 curl 下载（简洁高效）
- Node.js 适合 JSON 处理和复杂文本解析（项目已有 Node 环境）
- 避免引入新的运行时依赖（如 Python）

**备选方案**: 纯 Node.js 实现
- 劣势：下载和文件哈希计算需要额外依赖或代码
- 优势：跨平台兼容性更好（但 Windows 用户可用 Git Bash）

### 决策 3: 章节索引格式

**选择**: JSON 格式，包含标题、行范围、关键词

```json
{
  "hono": {
    "file": "docs/hono/llms-full.txt",
    "sections": [
      {
        "title": "CORS Middleware",
        "level": 3,
        "start_line": 234,
        "end_line": 267,
        "keywords": ["cors", "cross-origin", "headers"]
      }
    ]
  }
}
```

**理由**:
- AI 可通过行范围（offset/limit）精确读取章节内容
- 关键词支持快速匹配（未来可升级为 Embeddings）
- level 字段记录标题层级，便于处理嵌套结构

**备选方案**: 使用 SQLite 数据库存储索引
- 劣势：增加复杂度，需要额外的数据库操作
- 优势：支持更复杂的查询（但 JSON 已足够）

### 决策 4: 版本跟踪策略

**选择**: 使用内容哈希（SHA256）检测变化

`.version` 文件格式：
```json
{
  "source_url": "https://hono.dev/llms-full.txt",
  "downloaded_at": "2026-03-23T12:00:00Z",
  "content_hash": "a3f5b8c9...",
  "file_size": 153600
}
```

**理由**:
- 内容哈希可精确判断文档是否变化（比 Last-Modified 可靠）
- 避免重复下载相同内容，节省时间和带宽
- 记录下载时间和文件大小，便于调试

**备选方案**: 使用 HTTP ETag 或 Last-Modified
- 劣势：需要额外的 HEAD 请求，且并非所有服务器都支持
- 优势：无需下载完整文件即可判断（但下载也很快）

### 决策 5: AI 文档查找策略

**选择**: 三层查找策略（快速路径 → 降级路径 → 兜底路径）

```
快速路径: 读取 _sections.json → 匹配关键词 → Read 精确行范围
降级路径: Grep 搜索文档 → Read 匹配上下文
兜底路径: WebSearch 查询官方网站
```

**理由**:
- 快速路径覆盖 80% 的常见查询（< 1秒）
- 降级路径处理关键词不匹配的情况（~2秒）
- 兜底路径确保即使本地文档缺失也能工作

**备选方案**: 仅使用 Grep，不生成章节索引
- 劣势：每次查询需要扫描整个文档（慢）
- 优势：实现简单（但牺牲性能）

## Risks / Trade-offs

### 风险 1: 官方 URL 失效

**风险**: 框架官网可能更改 llms.txt 的 URL 路径

**缓解措施**:
- 在 `sync-docs.sh` 中添加 URL 验证和错误处理
- 下载失败时保留旧文档，不删除现有文件
- 在脚本输出中明确提示 URL 失效，方便手动修复

### 风险 2: 文档格式不一致

**风险**: 不同框架的 llms.txt 格式可能不统一（如标题标记方式不同）

**缓解措施**:
- 在 `generate-sections.js` 中添加容错逻辑
- 无法解析的文档返回空索引，不阻塞其他文档
- 记录警告信息，方便后续调整解析规则

### 风险 3: 文档过大

**风险**: 某些文档（如 Better Auth）可能超过 200KB，影响读取性能

**缓解措施**:
- 章节索引允许 AI 精确定位，避免读取整个文件
- 在 _sections.json 中添加 `size_warning` 标记
- 在 .cursorrules 中指示 AI 对大文件必须使用章节索引

### 权衡 1: Bash vs 纯 Node.js

**选择 Bash 的权衡**:
- 优势：下载和哈希计算简洁高效
- 劣势：Windows 用户需要 Git Bash 或 WSL

**决定**: 选择 Bash，因为项目已在 Windows 上使用 PowerShell 脚本（见 `scripts/clean-ports.ps1`），可以假设开发者有能力运行 Bash 脚本

### 权衡 2: 自动化 vs 灵活性

**选择自动生成索引的权衡**:
- 优势：零维护成本，索引始终与文档同步
- 劣势：无法手动调整章节分类或关键词

**决定**: 选择自动化，因为手动维护成本高且容易出错。如果需要自定义，可在 Phase 2 添加配置文件覆盖机制。

## Migration Plan

### 部署步骤

1. **创建脚本和配置** (PR #1)
   - 添加 `scripts/sync-docs.sh`
   - 添加 `scripts/generate-meta.js`
   - 添加 `scripts/generate-sections.js`
   - 更新 `package.json` 添加脚本命令

2. **首次同步** (本地操作)
   - 运行 `pnpm docs:sync` 下载所有文档
   - 验证 `docs/` 目录结构和索引文件

3. **更新 AI 配置** (PR #2)
   - 更新 `.cursorrules` 添加文档查找策略
   - 可选：更新 `.gitignore` 排除 `.version` 文件

4. **清理旧文件** (PR #3)
   - 删除或归档 `docs/*-reference.md` 文件

### 回滚策略

- 如果新系统有问题，可以快速恢复旧的 `-reference.md` 文件
- 删除 `docs/{framework}/` 目录和索引文件
- 恢复 `.cursorrules` 的旧版本

### 后续维护

- 建议每周运行一次 `pnpm docs:sync`
- 如果某个框架发布重大更新，可立即手动同步
- Phase 2 可考虑添加 GitHub Actions 自动同步（每周定时触发）

## Open Questions

1. **Windows 兼容性**: Bash 脚本在 Windows 上的运行是否需要特殊处理？
   - 建议：提供一个 PowerShell 版本的 `sync-docs.ps1` 作为备选

2. **文档更新通知**: 如何通知开发者文档有更新？
   - 建议：Phase 2 可在 PR 中自动添加评论说明哪些文档有变化

3. **框架版本映射**: 是否需要记录文档对应的框架版本号？
   - 建议：Phase 1 先不实现，大多数框架的 llms.txt 已包含版本信息

4. **章节索引精度**: 关键词匹配是否足够，还是需要 AI Embeddings？
   - 建议：Phase 1 先用关键词，根据实际使用效果决定是否升级
