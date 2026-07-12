# Phase 7: Comic External Image Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 7-Comic External Image Flow
**Areas discussed:** 章节 URL 可达性预检查, URL 标准化边界, 空结果覆盖策略, 数量回退覆盖策略, 封面与正文分流, Reader 失败体验, 后台完整性检查

---

## 章节 URL 可达性预检查

| Option | Description | Selected |
|--------|-------------|----------|
| 直接标准化后保存外链 URL | 不额外探测可达性，避免把源站瞬时抖动写成永久缺图 | ✓ |
| 保存前做轻量探测，但失败也照样入库 | 记录日志或探测结果，但不阻止外链入库 | |
| 保存前严格探测，不可达就不入库 | 抓取时就挡掉坏图，但容易被防盗链/临时限流误伤 | |
| 你决定 | 由 agent 选推荐方案 | |

**User's choice:** 直接标准化后保存外链 URL
**Notes:** 用户明确接受推荐方案，要求章节正文图的真实加载失败交给 Reader / admin 暴露，而不是在 crawler 阶段做保存前可达性预检。

---

## URL 标准化边界

| Option | Description | Selected |
|--------|-------------|----------|
| 转成绝对 URL，保留完整 query 参数 | 只做相对路径补全、去空值、去重，不清洗参数 | ✓ |
| 转成绝对 URL，并清理常见追踪参数 | URL 更干净，但可能误删签名/防盗链参数 | |
| 尽量原样保存，只在相对路径时补全 host | 侵入更小，但重复和编码差异更容易残留 | |
| 你决定 | 由 agent 选推荐方案 | |

**User's choice:** 转成绝对 URL，保留完整 query 参数
**Notes:** 用户显式选择保留 query 参数，优先保证源站签名与防盗链兼容性。

---

## 空结果覆盖策略

| Option | Description | Selected |
|--------|-------------|----------|
| 判定本章抓取失败，不覆盖已有 pages | 避免一次源站抖动把已有章节冲成空白 | ✓ |
| 照样同步空数组 | 用空数据表达当前抓取结果，但风险是把临时失败写成持久坏数据 | |
| 仅首次新章允许空入库，老章节禁止覆盖 | 折中方案 | |
| 你决定 | 由 agent 选推荐方案 | |

**User's choice:** 判定本章抓取失败，不覆盖已有 pages
**Notes:** 用户显式接受推荐方案，优先保护历史好数据。

---

## 数量回退覆盖策略

| Option | Description | Selected |
|--------|-------------|----------|
| 视为异常，不覆盖已有 pages | 只有数量持平或更多时才允许覆盖 | ✓ |
| 仍然以最新抓取结果为准 | 假设源站内容可能变化，但更容易把解析失败写进库里 | |
| 超过阈值才允许覆盖 | 例如达到旧页数 80% 才覆盖，做折中保护 | |
| 你决定 | 由 agent 选推荐方案 | |

**User's choice:** 接受推荐方案
**Notes:** 用户授权按推荐继续收口，因此该问题采用“不允许页数回退覆盖”的保守策略。

---

## 封面与正文分流

| Option | Description | Selected |
|--------|-------------|----------|
| 封面默认保留源站 URL，只有显式开关时才上传 R2 | 最符合“chapter pages 永不进 R2，covers 可显式使用 R2” | ✓ |
| 封面默认继续上传 R2，章节图改外链 | 延续现状，但默认成本更高、语义更混 | |
| 封面跟正文一样全部改外链，不再提供 R2 路径 | 成本最低，但放弃必要资产的稳定托管能力 | |
| 你决定 | 由 agent 选推荐方案 | |

**User's choice:** 接受推荐方案
**Notes:** 用户授权采用推荐方案，因此封面保留 R2 能力但变成显式 opt-in，不再与章节图共用默认上传行为。

---

## Reader 失败体验

| Option | Description | Selected |
|--------|-------------|----------|
| 保留 lazy loading/进度保存，并补“单图失败卡片 + 部分失败汇总 + 整章失败态” | 既满足 COMIC-04，又尽量不打断现有阅读流 | ✓ |
| 只做单图失败占位，不做章节级错误状态 | 改动较小，但不满足“usable chapter-level error state” | |
| 整章任一图片失败就直接切到强错误页 | 反馈明确，但对部分失败过于激进 | |
| 你决定 | 由 agent 选推荐方案 | |

**User's choice:** 接受推荐方案
**Notes:** 推荐方案保留阅读器现有滚动和进度逻辑，把失败体验拆成 per-image 与 chapter-level 两层。

---

## 后台完整性检查

| Option | Description | Selected |
|--------|-------------|----------|
| 保持 crawler 状态检查轻量，另加按需、只读的 admin 外链健康探测 | 兼顾成本与 COMIC-05 的真实失败报告 | ✓ |
| 仍靠 placeholder/failed 字符串判断外链失败 | 实现便宜，但无法发现真实外链失效 | |
| 每次 crawl/sync 都主动探测所有章节外链 | 信息最全，但会显著抬高抓取成本和失败面 | |
| 你决定 | 由 agent 选推荐方案 | |

**User's choice:** 接受推荐方案
**Notes:** 用户授权推荐方案，因此正常 crawl path 保持廉价，外链健康探测作为 admin/integrity action 单独触发，且不自动修复为 R2 mirror。

---

## the agent's Discretion

- 数量回退覆盖策略
- 封面与正文分流
- Reader 失败体验
- 后台完整性检查

## Deferred Ideas

- 自动镜像坏掉章节图到 R2 — 属于后续可靠性 phase，不在本次 Phase 7 落地。
- 多源 host fallback / 自动切换来源 — 另立后续 phase 处理。
