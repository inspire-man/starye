# Phase 06 Storage Policy

## Purpose and Scope

本文件是 Phase 6 的 canonical storage policy，用来在任何 cleanup、lifecycle、enforcement、上传改造开始前，冻结 Starye 对 R2、D1 和 source/external URL 的边界定义。

- 对应决策：D-01、D-02、D-03、D-04、D-05、D-06。
- 本 phase 只做审计与文档收敛，不做 R2 对象删除，不应用 lifecycle，不实施上传封禁，不迁移既有 R2 object，不重写 DB/API 历史字段。
- Anything not listed is forbidden by default or requires a later explicit classification before planning, per D-01.

## Executive Summary

当前 milestone 的默认前提是：R2 只保留必要资产和明确受控的短期/运维用途，漫画章节正文图与批量镜像不进入标准 allowlist。Phase 6 负责把 prefix 分类、历史风险和禁止用途写清楚，给 Phase 8/10 的 enforcement 和 cleanup 提供稳定边界，而不是在本阶段直接改运行时行为。

## Prefix Tree Snapshot

```text
R2 bucket
├── covers/                 # standard allowlist
├── avatars/               # standard allowlist
├── logos/                 # standard allowlist
├── fallback/              # standard allowlist
├── manual-assets/         # standard allowlist
├── mappings/              # restricted allowed
│   └── backups/           # restricted sub-prefix, growth-controlled only
├── tmp/                   # short-term allowed
├── crawler-debug/         # short-term allowed
├── import-staging/        # short-term allowed
├── images/                # historical risk pending classification
├── system/                # discovered unlisted prefix, operations classification required
└── ops/d1-backups/        # discovered unlisted prefix, operations classification required
```

## Allowlist

标准允许前缀仅限 D-02 定义的必要资产用途：

| Prefix | Status | Allowed purpose | Notes |
|--------|--------|-----------------|-------|
| `covers/` | Standard allowed | 漫画/电影封面、必要预览图 | 可长期保留，但仍需后续 phase 统一命名和写入入口。 |
| `avatars/` | Standard allowed | 演员头像、用户头像等必要头像 | 属于长期资产，不得挪作章节页镜像。 |
| `logos/` | Standard allowed | publisher / brand logo | 属于稳定展示资产。 |
| `fallback/` | Standard allowed | 小体积兜底图、失败占位图 | 只允许作为明确 fallback 资产，不得承载代理缓存。 |
| `manual-assets/` | Standard allowed | 后台手动上传且经 owner 明确认可的内容资产 | 需要在后续 phase 与 upload purpose allowlist 对齐。 |

## Restricted Allowed

`mappings/` 属于 D-03 定义的 restricted allowed prefix，可存在于 R2，但不得被视为“无限增长且无需审计”的普通资产。

| Prefix | Status | Allowed purpose | Required controls |
|--------|--------|-----------------|-------------------|
| `mappings/` | Restricted allowed | crawler mapping 文件、查表类小体积产物 | 后续 phase 必须保留 inventory、大小监控和用途说明。 |
| `mappings/backups/` | Restricted allowed | mapping 备份 | 必须在后续 phase 增加 backup count、lifecycle 或 growth audit controls，不能无限累积。 |

## Short-Term Allowed

`tmp/`、`crawler-debug/`、`import-staging/` 属于 D-04 定义的 short-term allowed prefixes，只在“短期诊断/暂存且有默认 retention 预期”的前提下允许存在。

| Prefix | Status | Allowed purpose | Default retention expectation | Audit rule |
|--------|--------|-----------------|-------------------------------|-----------|
| `tmp/` | Short-term allowed | 短期临时对象 | 后续 phase 必须补 retention window | 必须能区分创建者和清理责任。 |
| `crawler-debug/` | Short-term allowed | crawler 诊断输出 | 后续 phase 必须补 retention window | 不得作为长期 evidence bucket。 |
| `import-staging/` | Short-term allowed | 导入暂存对象 | 后续 phase 必须补 retention window | 必须能证明何时可清理。 |

## Historical Risk

`images/` 属于 D-05 锁定的 historical risk prefix。它不是标准 allowlist，也不是当前 phase 可以直接删除/迁移的对象集合。

| Prefix | Status | Why risky | Phase 6 action | Out of scope in Phase 6 |
|--------|--------|-----------|----------------|-------------------------|
| `images/` | Historical risk | 历史泛化命名无法表达真实用途，可能混入 cover、manual asset、章节正文图或其他镜像对象 | 审计 object inventory 和 DB references，保留为 pending classification | 不删除、不 rename prefix、不批量迁移对象。 |

## Forbidden Uses

以下用途按 D-06 视为 forbidden by default，不得并入 R2 标准资产策略：

| Use | Why forbidden | Phase 6 stance |
|-----|---------------|----------------|
| Comic chapter body images | 体量最大，直接冲突 milestone 的免费额度目标 | 只记录风险，不在本 phase 做 delete 或 rewrite。 |
| Bulk comic page mirrors | 会把外链正文图批量复制进 Cloudflare 存储 | 明确禁止纳入 allowlist。 |
| Worker / Pages Function image proxy caches | 会把阅读流量转成 Workers/Functions 成本 | 默认禁止，后续 phase 不得把 proxy cache 包装成 storage allowlist。 |
| Long-term debug dumps | 易失控增长，无业务必要性 | 只能作为短期诊断 prefix，不能长期保留。 |
| Any unlisted R2 purpose | D-01 要求显式 allowlist | 必须先做分类再规划实现。 |

## Discovered Unlisted Prefixes

Phase 6 额外发现了两个不能 silently 归入标准资产 allowlist 的前缀：

| Prefix | Current classification | Why not auto-allowlisted | Required next step |
|--------|------------------------|--------------------------|-------------------|
| `system/` | Discovered unlisted prefix | 属于 system-purpose / generated artifact，不是标准业务资产前缀 | 先做 operations classification，再决定是否进入正式运维策略。 |
| `ops/d1-backups/` | Discovered unlisted prefix | 属于操作备份例外，不是封面/头像/手动资产一类用途 | 后续 phase 单独评估 delete risk、cost risk 和保留策略。 |

`system/` 与 `ops/d1-backups/` 在本 phase 只被记录为 discovered unlisted prefixes。后续 phase 不得默认把它们并入 `covers/`、`manual-assets/` 或任何标准媒体资产 allowlist。

## Policy Matrix

| Decision | Policy outcome in Phase 6 |
|----------|---------------------------|
| D-01 | R2 采用 explicit allowlist；未列出的 prefix / purpose 默认禁止或待单独审批。 |
| D-02 | `covers/`、`avatars/`、`logos/`、`fallback/`、`manual-assets/` 为 standard allowed prefixes。 |
| D-03 | `mappings/` 为 restricted allowed；`mappings/backups/` 必须受增长或 lifecycle 约束。 |
| D-04 | `tmp/`、`crawler-debug/`、`import-staging/` 仅作为 short-term allowed，必须补 retention / audit 规则。 |
| D-05 | `images/` 为 historical risk，Phase 6 只审计，不删除、不 rename。 |
| D-06 | 漫画章节正文图、批量镜像、代理缓存、长期 debug dump 与任何未列用途都属于 forbidden uses。 |

## Restrictions and Follow-up

本文件只定义边界，不宣布任何 cleanup 或 enforcement 已完成。后续 phase 必须继续遵守以下限制：

1. Phase 6 不删除 R2 对象。
2. Phase 6 不应用 lifecycle。
3. Phase 6 不实施上传封禁或 write-path enforcement。
4. Phase 6 不把 `images/`、`system/`、`ops/d1-backups/` 自动升级为标准 allowlist。
5. Phase 8/10 的实现必须复用本文件的 prefix 分类，不得重新发明术语。
