# Documentation Map

docs/ 是仓库内长期知识的记录系统。它提供稳定入口和渐进式导航，不替代当前状态、OpenSpec 契约或 phase 证据。

## 从哪里开始

| 目的 | 入口 |
|------|------|
| 了解系统边界 | ../ARCHITECTURE.md |
| 了解设计决策 | DESIGN.md、design-docs/index.md |
| 了解当前工作和执行计划 | PLANS.md、exec-plans/README.md |
| 了解产品范围 | PRODUCT_SENSE.md、product-specs/index.md |
| 了解质量、可靠性和安全 | QUALITY_SCORE.md、RELIABILITY.md、SECURITY.md |
| 查询外部框架文档 | references/README.md |
| 查询自动生成索引 | generated/README.md |
| 追溯旧报告 | archive/README.md |

## 写入规则

- 稳定的跨模块知识写入 docs/ 对应分类。
- 当前 milestone、phase、验收证据写入 .planning/。
- 新功能的契约、设计和任务写入 openspec/。
- 应用或包的局部开发说明可以留在对应目录，并从这里建立入口。
- 外部 llms.txt 和 generated JSON 不手工编辑。

## 维护入口

- pnpm docs:sync：同步托管的官方参考资料并生成索引。
- pnpm docs:meta：只重新生成 generated/_meta.json。
- pnpm docs:index：只重新生成 generated/_sections.json。
- pnpm docs:check：检查路径、版本哈希、索引和 live Markdown 链接。
