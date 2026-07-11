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

## Naming Glossary

本节锁定 D-15、D-16、D-17、D-18 的命名语义，避免后续 phase 把 source/external URL 与 R2 asset 混为一谈。

| Term | Locked meaning | Notes |
|------|----------------|-------|
| `sourceImageUrl` | 源站图片 URL | 指 crawler 从源站拿到并保留的原始图片地址。 |
| `externalImageUrl` | 外部图片 URL | 与 `sourceImageUrl` 同类，强调该 URL 不由 Starye R2 持有。 |
| `r2Key` | R2-backed asset identity | 用于 object identity、审计、DB reference checks，不等于 display URL。 |
| `r2Url` | R2-backed asset access URL | 仅表示访问/展示 URL，不应替代 `r2Key` 做审计或引用判定。 |
| `image_url` | 历史字段名 | 当前 `chapter.pages.image_url` 继续存在，但 Phase 6 锁定其语义为 source/external URL。 |
| `images: string[]` | 历史 API 字段名 | 当前 public comics API 输出字段，Phase 6 锁定其语义为章节图片 source/external URLs 列表。 |

## Semantic Locks for Existing Fields

根据 D-16 与 D-17，历史字段名可以暂时保留，但语义必须冻结：

| Surface | Current name | Locked semantics in Phase 6 | Not required in Phase 6 |
|---------|--------------|-----------------------------|-------------------------|
| D1 chapter pages | `chapter.pages.image_url` | source/external chapter image URL，不代表 R2 object | 不重命名字段，不回填新列。 |
| Public comics API | `images: string[]` | 返回章节图片 source/external URLs；允许后续 phase 扩展来源元数据 | 不改 response field name。 |
| R2-backed assets | `r2Key` + `r2Url` | `r2Key` 负责身份与审计，`r2Url` 负责展示与访问 | 不要求本 phase 改所有既有变量名。 |

当前 phase 只锁定命名语义，不做字段或接口改名。也就是说，`image_url` 与 `images: string[]` 作为历史字段名继续存在，但它们在文档语义上已经被固定为 source/external URL，而不是 R2-backed asset URL。

## Storage vs Proxy vs Cache

根据 D-18，storage、proxy、cache 必须明确拆开：

| Concept | Definition in this repo | Default status for chapter images |
|---------|-------------------------|-----------------------------------|
| `storage` | 对象实际存入 R2，并拥有可审计的 `r2Key` / `r2Url` | 默认禁止用于 chapter body images。 |
| `proxy` | Worker / Pages Function 代替浏览器去请求源站图片，再转发给前端 | 默认禁止。 |
| `cache` | CDN 或浏览器对已有响应的缓存行为 | 不是 storage，也不能被当成 R2 allowlist 的替代说法。 |

章节图代理默认禁止，代理缓存也默认禁止。后续 phase 即使为了诊断引入短期 proxy，也不能把它描述成“图片已经安全进入 storage allowlist”。

## Forbidden-Risk Baseline

本节记录 D-15、D-16、D-17、D-18 共同约束下的当前回归基线，只做 baseline，不做修复承诺：

```text
comic-crawler -> ImageProcessor -> syncChapterData -> pages.image_url -> public comics API -> comic-app
```

这条链路目前代表“章节正文图可能已被上传为 R2 URL，并继续通过历史字段名对外暴露”的 forbidden-risk baseline。Phase 6 的职责是记录它、命名它、冻结后续判断标准，而不是顺手在本 phase 改行为。

具体约束如下：

1. `comic-crawler` 对 chapter pages 的处理必须与 cover 资产分开理解。
2. `ImageProcessor` 本身不是 policy；真正的风险来自 caller 是否把 chapter body images 当作可上传资产。
3. `syncChapterData` 把结果写进 `pages.image_url` 时，当前仍受历史字段名约束，后续 phase 必须先处理语义和调用链，再考虑改名或迁移。
4. public comics API 的 `images: string[]` 和 `comic-app` 当前消费链路被视为回归 baseline，后续 phase 修改时必须能证明没有再把 source/external URL 与 `r2Url` 混淆。

## Current Heuristics

- 当文档或代码写 `sourceImageUrl` / `externalImageUrl` 时，应理解为“不持有对象身份的外部 URL”。
- 当文档或代码写 `r2Key` / `r2Url` 时，应理解为“持有对象身份且属于 R2-backed asset”的语义对。
- 当出现 `image_url` 或 `images` 这类历史名字时，默认先按 source/external URL 解释，除非后续 phase 完成了显式迁移。
- 当有人试图用“proxy cache”来规避 storage policy 时，按 forbidden by default 处理，直到后续 phase 给出单独设计和成本论证。

## Future Enforcement Hooks

- Phase 7 应基于本文件把章节正文图链路从 R2 upload 语义剥离出来，但不能反向改写本 phase 的术语定义。
- Phase 8 应把 upload purpose allowlist、rejected chapter page uploads、retention rules 和 audit checks 对齐到本文件的 prefix / glossary 术语。
- Phase 10 应用同一套命名边界整理代码，不得重新定义 `r2Key`、`r2Url`、`sourceImageUrl`、`externalImageUrl`。

## Restrictions and Follow-up

本文件只定义边界，不宣布任何 cleanup 或 enforcement 已完成。后续 phase 必须继续遵守以下限制：

1. Phase 6 不删除 R2 对象。
2. Phase 6 不应用 lifecycle。
3. Phase 6 不实施上传封禁或 write-path enforcement。
4. Phase 6 不把 `images/`、`system/`、`ops/d1-backups/` 自动升级为标准 allowlist。
5. Phase 8/10 的实现必须复用本文件的 prefix 分类，不得重新发明术语。
