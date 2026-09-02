## Context

当前 docs/ 同时承担框架 llms.txt、专题指南、设计草稿和归档材料。同步入口分为 PowerShell 和 Bash，两者的输出文件名已经不一致；索引脚本只查找 llms-full.txt，因此现有 generated metadata 没有有效条目。

项目已有明确的 owner：README/AGENTS/RUNBOOK 负责根入口和稳定运维，.planning 负责阶段状态与证据，OpenSpec 负责能力契约。本 change 将 docs/ 做成这些 owner 之间的导航层，而不是再创建一套状态系统。

## Goals / Non-Goals

**Goals:**

- 让 agent 从短入口逐级进入架构、设计、计划、专题指南和外部参考。
- 让同步、索引和完整性检查在 Windows 与类 Unix 环境使用同一份来源清单。
- 让每个 agent 可见的坏路径都有可重复的检查或明确的归属。
- 迁移过程中保留历史材料和现有 .planning/OpenSpec 记录。

**Non-Goals:**

- 不重写 .planning phase、milestone 证据或 OpenSpec archive。
- 不把所有应用局部文档强行搬到根 docs/；局部文档仍靠 docs/ 入口索引。
- 不把外部文档翻译、摘要或二次加工。
- 不增加数据库、API、前端运行时依赖或新的远程服务。

## Decisions

### 1. 按知识类型分层

采用 docs/design-docs、docs/product-specs、docs/exec-plans、docs/guides、docs/references、docs/generated 和 docs/archive。类型优先于应用名称，便于 agent 先确定资料性质再读取具体内容。应用内部 README 和组件文档保留在应用目录，因为它们需要靠近代码。

### 2. 保留现有 canonical owners

ARCHITECTURE.md 只提供稳定顶层地图；详细 codebase 快照仍在 .planning/codebase/。PLANS.md 只说明如何进入 .planning 与 OpenSpec，不复制任务状态。RUNBOOK、AGENTS、README 和 OpenSpec 的内容不在 docs/ 重复。

### 3. 使用单一 Node 同步入口

scripts/docs-sources.json 是唯一来源清单；scripts/sync-docs.mjs 负责下载、SHA256、原子替换、.version 和索引生成。Node 20+ 已是项目运行前提，移除 PowerShell/Bash 双实现可以消除文件名和 URL 漂移。托管资料统一保存为 docs/references/frameworks/<id>/llms.txt。

### 4. 生成物集中存放

索引保存到 docs/generated/_meta.json 和 docs/generated/_sections.json。索引只扫描 references/frameworks，避免把 archive、unmanaged 或导航 Markdown 当成框架资料。

### 5. 完整性检查作为反馈回路

scripts/check-docs.mjs 不依赖网络，检查 manifest 与本地文件、.version 哈希、生成索引以及 live Markdown 的本地链接。CI 执行 pnpm docs:check；需要联网更新资料时仍由操作者显式运行 pnpm docs:sync。

## Risks / Trade-offs

- [外部 URL 变化] -> 保留旧文件，按单项报告失败；docs:check 通过本地一致性而不是网络状态。
- [路径迁移遗漏引用] -> 迁移后执行 docs:check，修复 live 文档链接；历史 archive 不作为 live 检查范围。
- [索引路径改变] -> 同一 change 同步更新 .cursorrules、OpenSpec delta 和 docs 入口，不提供第二套旧索引路径。
- [生成器误把不完整资料纳入] -> 只接受 manifest 中的目录，并要求 llms.txt、.version 和匹配哈希。
