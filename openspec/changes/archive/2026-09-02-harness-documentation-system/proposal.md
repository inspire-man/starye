## Why

当前仓库已经有 AGENTS.md、.planning、OpenSpec 和 docs/ 的雏形，但长期知识、框架参考、阶段证据和历史报告混在不同层级。更直接的问题是框架资料实际保存为 llms.txt，而索引脚本按 llms-full.txt 查找，导致两个索引始终为空，agent 得不到可靠的快速入口。

两篇参考文章都把重点放在“地图、工具和反馈回路”：AGENTS.md 应该是短入口，仓库应成为记录系统，每次 agent 错误都应沉淀成可执行规则或检查。这个 change 将这些原则适配到 Starye 已有的 .planning 和 OpenSpec 边界中。

## What Changes

- 建立 ARCHITECTURE.md 和 docs/ 总入口，按 design docs、product specs、execution plans、guides、references、generated、archive 分层。
- 将托管的外部框架资料迁移到 docs/references/frameworks/，把未纳入清单的 Workers AI 资料单独标为 unmanaged。
- 将稳定专题文档迁移到对应分类，将明确的历史或已取代材料归入 docs/archive/，并修复 live Markdown 链接。
- 用一个跨平台 Node 同步入口和共享来源清单替代 PowerShell/Bash 的路径漂移，统一使用 llms.txt 和 .version。
- 将生成索引迁移到 docs/generated/，生成真实的元数据和章节索引。
- 增加 pnpm docs:check，并在 CI 中执行，检查文档路径、版本哈希、索引一致性和 live Markdown 链接。
- 更新 .cursorrules、脚本、README 和文档归属，明确 .planning 与 OpenSpec 不被复制到 docs/。

## Capabilities

### New Capabilities

- documentation-integrity：检查文档布局、来源版本、生成索引和 live 文档链接。

### Modified Capabilities

- docs-sync：修改托管资料的路径、文件名、来源清单和跨平台同步入口。
- docs-indexing：修改扫描根目录、输出目录和索引中的本地路径。
- ai-docs-strategy：修改 agent 查找映射和渐进式读取入口。

## Impact

- 脚本：scripts/sync-docs.mjs、scripts/docs-sources.json、scripts/generate-meta.js、scripts/generate-sections.js、scripts/check-docs.mjs。
- 配置：package.json、.github/workflows/ci.yml、.cursorrules。
- 文档：docs/、ARCHITECTURE.md、部分根目录和局部 README。
- 不修改 API、数据库 schema、部署资源或运行时业务逻辑；.planning/ 和 OpenSpec 历史目录保留原位置。

## 风险

- 路径迁移会暴露未发现的 Markdown 链接，先用 docs:check 失败清单逐项修复。
- 外部源可能临时不可用，同步失败时保留旧文件和旧版本，并让索引检查明确指出状态。
- 现有 OpenSpec 历史文本仍可能引用旧路径，本 change 只修复 live 文档，不重写历史证据。
