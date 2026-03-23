# 文档同步系统

本项目使用本地文档同步系统，为 AI 助手提供快速、准确的技术栈文档访问能力。

## 支持的技术栈

- **Hono** - Web framework built on Web Standards
- **Better Auth** - TypeScript authentication framework
- **Nuxt** - Vue framework for building web applications
- **Zod** - TypeScript-first schema validation
- **Vite** - Next generation frontend tooling
- **Vitest** - Vite-native unit test framework
- **Vue** - The Progressive JavaScript Framework
- **Turborepo** - High-performance build system for monorepos
- **Drizzle ORM** - TypeScript ORM for SQL databases

## 首次使用

克隆仓库后，运行以下命令下载所有文档：

```bash
pnpm docs:sync
```

这将：
1. 从官方源下载所有技术栈的 `llms.txt` 文档
2. 生成元数据索引 (`docs/_meta.json`)
3. 生成章节索引 (`docs/_sections.json`)

## 更新文档

建议每周运行一次文档同步，以获取最新的官方文档：

```bash
pnpm docs:sync
```

该命令会：
- 检测文档是否有更新（通过内容哈希）
- 仅下载有变化的文档
- 自动重新生成索引

## 单独操作

如果只需要重新生成索引（不下载文档）：

```bash
# 重新生成元数据索引
pnpm docs:meta

# 重新生成章节索引
pnpm docs:index
```

## 文档结构

```
docs/
├── _meta.json              # 元数据索引（自动生成，不提交）
├── _sections.json          # 章节索引（自动生成，不提交）
├── hono/
│   ├── llms-full.txt      # Hono 文档（自动生成，不提交）
│   └── .version           # 版本跟踪（自动生成，不提交）
├── better-auth/
│   ├── llms-full.txt
│   └── .version
└── ...
```

## AI 文档查找策略

AI 助手在回答技术问题时会自动：

1. **快速路径**：通过章节索引快速定位相关章节
2. **降级路径**：使用 Grep 搜索关键词
3. **兜底路径**：使用 WebSearch 查询官方网站

详见 `.cursorrules` 中的文档参考策略。

## 脚本说明

- `scripts/sync-docs.ps1` - PowerShell 同步脚本（Windows）
- `scripts/sync-docs.sh` - Bash 同步脚本（Unix/Mac）
- `scripts/generate-meta.js` - 生成元数据索引
- `scripts/generate-sections.js` - 生成章节索引

## 注意事项

- 文档文件和索引文件已添加到 `.gitignore`，不会提交到版本控制
- 首次克隆仓库后必须运行 `pnpm docs:sync` 才能使用 AI 文档查询功能
- 文档总大小约 6-7 MB，同步时间约 30-60 秒
