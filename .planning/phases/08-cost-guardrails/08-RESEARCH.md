# Phase 8: Cost Guardrails - Research

**Researched:** 2026-07-13
**Domain:** R2 purpose allowlist, upload boundary enforcement, audit/lifecycle/budget guardrails
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/api/upload` 使用业务化且窄口径的 purpose 字典，不再暴露泛化 `images/` 上传语义。 [VERIFIED: 08-CONTEXT.md]
- **D-02:** 通用上传入口只服务人工资产和少量明确用途；`mappings/`、`mappings/backups/`、`import-staging/`、`crawler-debug/`、`ops/d1-backups/` 这类内部前缀不得暴露给 `/api/upload`。 [VERIFIED: 08-CONTEXT.md]
- **D-03:** 富文本正文插图保留单独 purpose `blog_inline`，不得与通用 `manual_asset` 混用。 [VERIFIED: 08-CONTEXT.md]
- **D-04:** 人工上传 purpose 采用少量业务化名称，而不是每个模型一个 purpose。下游规划应保持清晰但避免字典膨胀。 [VERIFIED: 08-CONTEXT.md]
- **D-05:** Phase 8 先收紧 `/api/upload` 与 crawler 主链路；像 comic cover presign 这类历史或旁路上传面只要求“不能绕过成本边界”，彻底统一留到 Phase 10。 [VERIFIED: 08-CONTEXT.md]
- **D-06:** `tmp/` 的默认保留窗口是 3 天。 [VERIFIED: 08-CONTEXT.md]
- **D-07:** `crawler-debug/` 的默认保留窗口是 3 天。 [VERIFIED: 08-CONTEXT.md]
- **D-08:** `import-staging/` 的默认保留窗口是 7 天。 [VERIFIED: 08-CONTEXT.md]
- **D-09:** `mappings/backups/` 的默认保留窗口是 14 天。 [VERIFIED: 08-CONTEXT.md]
- **D-10:** `mappings/backups/` 除了按时间清理，还要加数量护栏：每类映射只保留最近 20 份。 [VERIFIED: 08-CONTEXT.md]
- **D-11:** `tmp/`、`crawler-debug/`、`import-staging/` 应作为明确的自动过期目标；`mappings/backups/` 需要“14 天 + 每类最近 20 份”的审计/清理护栏。 [VERIFIED: 08-CONTEXT.md]
- **D-12:** 以下情况属于硬失败，`RUNBOOK` 和审计流程必须要求处理：`comics/<slug>/<chapter>` 仍有新对象增长；通用上传仍写入泛化 `images/`；`mappings/backups/` 超过 14 天或超过每类最近 20 份；`tmp/`、`crawler-debug/`、`import-staging/` 存在过期对象。 [VERIFIED: 08-CONTEXT.md]
- **D-13:** `system/` 与 `ops/d1-backups/` 先作为审计项记录，不在本 phase 自动判为硬失败；它们仍需要保留 operations 视角的分类和审查。 [VERIFIED: 08-CONTEXT.md]
- **D-14:** Cloudflare Budget Alerts 采用双阈值：月度累计花费达到 `$1` 时预警，达到 `$3` 时升级提醒。 [VERIFIED: 08-CONTEXT.md]
- **D-15:** `RUNBOOK` 必须明确写出 Budget Alerts 只负责通知，不会自动阻止计费。 [VERIFIED: 08-CONTEXT.md]
- **D-16:** `audit-r2-storage` 以手动主导为主，但在存储策略相关改动、cleanup、migration、批量导入前必须先跑一次审计。 [VERIFIED: 08-CONTEXT.md]
- **D-17:** 如果审计结果存在 `db_reference_status=missing_credentials`、`partial` 或 `missing_query_context`，则对 cleanup、删除、lifecycle 变更一律阻断；没有完整审计证据时只能继续读、看、记，不能执行实际清理动作。 [VERIFIED: 08-CONTEXT.md]

### the agent's Discretion

- 规划阶段可在不偏离上述约束的前提下，细化最终 purpose 枚举命名，例如把封面类拆成 `post_cover`、`movie_cover` 等少量明确业务名，但不得回退成泛化 `images/` 或把内部前缀暴露给 `/api/upload`。 [VERIFIED: 08-CONTEXT.md]
- 对 comic cover presign 或其他历史上传路径，执行方案可采用最小改动的“复用 allowlist / 显式 deny / 补 guard”方式，只要它们不能绕过成本边界，且不把 Phase 10 的全面统一提前拉进本 phase。 [VERIFIED: 08-CONTEXT.md]
- 生命周期执行可组合使用 Cloudflare R2 lifecycle 与脚本/运行手册清理约束；但 count-based 的 `mappings/backups/` 护栏必须保留为可执行规则，而不是纯口头建议。 [VERIFIED: 08-CONTEXT.md]

### Deferred Ideas (OUT OF SCOPE)

- `/api/upload`、presign、crawler、脚本 helper 的全面统一与共享存储 contract 收敛，留到 Phase 10。 [VERIFIED: 08-CONTEXT.md]
- `system/` 与 `ops/d1-backups/` 的更完整 operations 分类、长期 retention 策略和更细粒度告警规则，留给后续 operations / cleanup 相关 phase。 [VERIFIED: 08-CONTEXT.md]
- 固定周期自动运行审计（例如周跑/月跑）的自动化，如果以后需要，可作为后续 operations 能力再立项；本 phase 先采用“手动主导 + 关键变更前强制”。 [VERIFIED: 08-CONTEXT.md]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COST-01 | `/api/upload` requires an explicit asset purpose and only allows approved R2 purposes such as cover, poster, avatar, logo, fallback, manual, or temp. | 现有 `/api/upload` 仍只接收 `file` 并统一写到 `images/`；Phase 8 计划必须同时改 route、请求体合同和 dashboard manual consumers。 [VERIFIED: codebase grep] |
| COST-02 | Crawler image processing uses the same approved-purpose policy and refuses `comic_chapter_page` uploads. | 现有 `ImageProcessor.process()` 只有 `keyPrefix` / `filename`，没有 `purpose` 或 namespace guard；拒绝点必须前移到上传边界。 [VERIFIED: codebase grep] |
| COST-03 | R2 lifecycle guidance exists for tmp/debug/import-staging/mapping backup prefixes, including recommended retention windows. | prefix taxonomy 已有，但现有脚本只有粗粒度风险，没有 `3d/3d/7d/14d + recent 20` 的 guardrail 表达。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md] |
| COST-04 | Owner has a repeatable R2 cost audit command or runbook section that checks forbidden prefixes and high-growth prefixes. | 现有 `audit-r2-storage.ts` 已经是 read-only 审计入口，但 `RUNBOOK.md` 尚未记录何时必须运行、哪些结果硬阻断 cleanup/lifecycle。 [VERIFIED: codebase grep] |
| COST-05 | RUNBOOK documents Cloudflare Budget Alerts with low-cost thresholds and states that alerts notify only; they do not stop billing automatically. | `RUNBOOK.md` 目前没有 Budget Alerts 章节；Cloudflare 官方文档明确该能力只发通知、不自动 pause 或 cap usage。 [VERIFIED: codebase grep] [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- 默认用中文输出结论、假设、风险、验证结果和下一步动作。 [VERIFIED: AGENTS.md]
- 任何涉及登录态或 cookie 的人工验证都必须走 `http://localhost:8080/...` Gateway 路径，而不是直连 `3000/3001/3002/3003/5173/8787` 端口。 [VERIFIED: AGENTS.md]
- API 方案应保持 Hono route + `serviceAuth` + schema validation 的现有结构；前端优先走 typed API wrapper，只有当前遗留 raw `fetch` 路径需要被 Phase 8 有意识地收口。 [VERIFIED: AGENTS.md] [VERIFIED: starye-hono-rpc SKILL]
- crawler 方案不能把上传策略塞进 parser；应维持 parser/strategy 分层，并把 upload guard 放在 `ImageProcessor` 边界或其紧邻 helper。 [VERIFIED: AGENTS.md] [VERIFIED: starye-crawler-strategy SKILL]
- 实施时如需改动已有函数/方法，必须先跑 GitNexus impact，再在提交前跑 `gitnexus detect-changes`。 [VERIFIED: AGENTS.md]
- Phase 8 的最小验证集合仍应覆盖 `pnpm type-check`、`pnpm lint`、`pnpm test`，并按改动范围补 API / dashboard / crawler 的局部 Vitest 命令。 [VERIFIED: AGENTS.md]

## Summary

Phase 8 是“运行时护栏 phase”，不是“历史对象 cleanup phase”，也不是“全仓库存储 helper 统一 phase”。仓库已经有 Phase 6 的 prefix 词汇表、Phase 7 的漫画正文图外链边界、现成的 R2 审计脚本，以及一个现成但过宽的 `/api/upload`；真正缺的是把这些边界变成 fail-closed 的运行时合同和 owner-facing 的运维步骤。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: 06-STORAGE-POLICY.md] [VERIFIED: codebase grep]

当前最需要 planner 知道的 5 件事是：`1)` `/api/upload` 的真实合同和 dashboard consumers 仍然活着，改 API 时不能只看 route 本身；`2)` crawler 侧真正的守门点是 `ImageProcessor.process()`，不是单个 crawler caller；`3)` `mappings/backups/` 的风险来自持续小文件增长，必须做 age + per-series count 双护栏；`4)` `RUNBOOK.md` 与 `audit-r2-storage.ts` 已经是既有运维/审计落点，Phase 8 不应该重新发明第二套文档或第二个 audit CLI；`5)` `system/`、`ops/d1-backups/`、文档瘦身和全面 helper 收敛都要明确延后到 Phase 9/10。 [VERIFIED: codebase grep] [VERIFIED: ROADMAP.md] [VERIFIED: REQUIREMENTS.md]

**Primary recommendation:** 把 Phase 8 规划成三段式收口：先统一 manual upload purpose 合同并封掉 `images/` 新写入，再在 `ImageProcessor` 边界补 crawler/script 级 purpose guard，最后增强 `audit-r2-storage.ts` + `RUNBOOK.md` 把 hard failure、retention window、Budget Alerts 和 cleanup/lifecycle 阻断条件正式化。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/api/upload` purpose allowlist | API / Backend | Dashboard | route、auth gate、R2 write 和 `media` insert 都在 API；当前 manual consumers 都在 dashboard。 [VERIFIED: codebase grep] |
| crawler/script purpose enforcement | Crawler / Scripts | Shared local contract module | 真实 drift 风险在 `ImageProcessor.process()` 的自由 `keyPrefix`；应在上传边界前 fail closed。 [VERIFIED: codebase grep] |
| mapping backup growth guard | Audit script | Mapping writers | 现阶段最关键的是“可审计、可阻断”，不是立刻写删除器。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md] |
| lifecycle guidance | RUNBOOK | Cloudflare R2 bucket settings | Cloudflare 已支持 prefix-scoped lifecycle rules；Phase 8 需要的是 guidance 与 evidence gate，不是批量自动清理。 [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/] [VERIFIED: 08-CONTEXT.md] |
| budget alert operations | RUNBOOK | Cloudflare Billing UI | Budget Alerts 是 account-level billing 配置，不属于应用 runtime。 [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hono` + `serviceAuth` | repo pin `^4.12.14`; npm current `4.12.30` on 2026-07-13 | 承载 `/api/upload` 的现有 route、角色限制和 JSON 响应面。 | 这是仓库现有 API 基础设施；Phase 8 应扩展同一条 upload surface，而不是再造第二条通用上传入口。 [VERIFIED: codebase grep] [VERIFIED: npm view] |
| Cloudflare R2 Object Lifecycles | docs updated 2026-04-21 | 为 `tmp/`、`crawler-debug/`、`import-staging/`、`mappings/backups/` 提供 prefix-scoped retention rule 语义。 | 官方已支持按 prefix 配置 bucket-level lifecycle 规则，并说明删除通常在过期值后 24h 内生效。 [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/] |
| `packages/crawler/scripts/audit-r2-storage.ts` | in-repo CLI | Phase 8 的单一 read-only audit 执行入口和报告契约。 | 现有脚本已拥有 prefix taxonomy、`db_reference_status`、MD/JSON/CSV 报告和 fail-closed 语义；扩展它比新造第二个脚本更稳。 [VERIFIED: codebase grep] |
| Cloudflare Budget Alerts | docs updated 2026-05-29 | 低成本 owner-facing 支出预警。 | 官方文档明确它按账期累计 usage-based spend 发单次邮件通知，适合 Phase 8 的“先提醒、后人工处理”目标。 [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `valibot` | repo pin `^1.3.1`; npm current `1.4.2` on 2026-06-28 | 为新 `purpose` 请求字段、枚举和 namespace 校验提供统一 schema。 | 如果 Phase 8 给 `/api/upload` 或共享 policy module 引入显式 request/contract schema，应直接复用现有验证栈。 [VERIFIED: codebase grep] [VERIFIED: npm view] |
| `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` | repo pin `^3.1031.0`; npm current client `3.1085.0` on 2026-07-10 | crawler/script 侧 R2 上传实现。 | `ImageProcessor`、mapping manager 和潜在 presign helper 都已基于 AWS S3-compatible SDK；Phase 8 不需要换库。 [VERIFIED: codebase grep] [VERIFIED: npm view] |
| `vitest` | repo pin `^4.1.4`; npm current `4.1.10` on 2026-07-06 | API / dashboard / crawler 的局部验证。 | 已有 `comic-crawler.chapter-flow.test.ts` 与 `audit-r2-storage.test.ts`，Phase 8 最合适的增量验证仍是 Vitest。 [VERIFIED: codebase grep] [VERIFIED: npm view] |
| `pnpm exec wrangler` | local `4.90.1`; global not installed | 列出或设置 bucket lifecycle 规则时的 CLI 入口。 | 当前机器没有全局 `wrangler`，但 `apps/api` 下 `pnpm exec wrangler --version` 可用；planner 不应写裸 `wrangler` 命令。 [VERIFIED: environment audit] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 继续保留 `Comics.vue` 的独立 presign 上传面 | 把 manual comic cover 收回同一条 `/api/upload` purpose 合同 | 统一 route 会少一个旁路，但会让 dashboard UI 代码一起改；这比 resurrect 一个未落地的 `/upload/presign` route 更符合 Phase 8 的 tight scope。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md] |
| 自写定时 cleanup 逻辑 | R2 lifecycle + audit hard-failure gate | Cloudflare 已提供 prefix lifecycle；Phase 8 只需把规则和证据门写清，不必本 phase 上自动删除器。 [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/] [VERIFIED: 08-CONTEXT.md] |
| 新建第二个 storage-policy helper package | 先做 repo-local shared purpose contract | Phase 10 才做全面 helper 收敛；Phase 8 只需要一个薄的共享规则层防止 API/crawler drift。 [VERIFIED: 08-CONTEXT.md] |

**Installation:**
```bash
# Phase 8 不应新增依赖；复用现有 workspace 依赖即可。
```
[VERIFIED: codebase grep]

**Version verification:** 已执行 `npm view hono version`、`npm view valibot version`、`npm view wrangler version`、`npm view @aws-sdk/client-s3 version` 与 `npm view vitest version`；上游版本有更新，但 COST-01..05 不需要依赖升级即可完成。 [VERIFIED: npm view] [VERIFIED: codebase grep]

## Package Legitimacy Audit

Phase 8 不应安装新包；现有 workspace 依赖已经覆盖 upload guard、schema validation、crawler R2 上传、测试和 Cloudflare CLI 需求。 [VERIFIED: codebase grep]

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: codebase grep]
**Packages flagged as suspicious [SUS]:** none. [VERIFIED: codebase grep]

## Current Contract Surfaces

### `/api/upload` contract and likely consumers to preserve

- route 挂载在 `/api/upload`，由 `serviceAuth(['admin', 'super_admin', 'comic_admin', 'movie_admin'])` 保护，只解析 multipart `file` 字段，校验 `10MB` 上限、图片 MIME 和扩展名，然后写入 `images/<timestamp>-<nanoid>.<ext>`，最后尝试插入 `media` 表并返回 `{ id, url, key, size, mimeType }`。 [VERIFIED: codebase grep]
- `apps/dashboard/src/views/PostEditor.vue` 的 wangEditor 上传逻辑直接 `fetch('/api/upload')`，只要求响应里有可用的 `url` 字段；它已经兼容 `data.url` 或 `data.data.url` 两种形状。 [VERIFIED: codebase grep]
- `apps/dashboard/src/components/ImageUpload.vue` 通过 `api.upload.uploadImage(file)` 依赖同一路由，并把 `response.url` 回填到表单；当前确认的消费者是 `Actors.vue` 的 `avatar`、`Movies.vue` 的 `coverImage` 和 `Publishers.vue` 的 `logo`。 [VERIFIED: codebase grep]
- `apps/dashboard/src/views/Comics.vue` 是当前需要保留的历史上传面，但它并不走 `/api/upload`，而是调用 `api.upload.presign()` 后直接 `PUT` 到 `uploadUrl`；仓库里没有对应的 `/api/upload/presign` route，只有一个未被引用的 `apps/api/src/lib/r2.ts::generatePresignedUrl()` helper。 [VERIFIED: codebase grep]
- 在 `apps/dashboard/src` 范围内未发现其他 `/api/upload` 或 `api.upload.uploadImage()` 的调用点；planner 可以把上述 4 个 UI 面视为 Phase 8 的 manual upload 全量显式 consumers。 [VERIFIED: codebase grep]

### Current crawler image upload contract and how to reject `comic_chapter_page` cleanly

- crawler 当前真正的上传合同是 `ImageProcessor.process(imageUrl, keyPrefix, filename, refererUrl?)`；该方法先下载源图，再派生 `thumb/preview/original` 三个变体并上传，所以如果 guard 放在上传后段，会先产生网络和 CPU 副作用。 [VERIFIED: codebase grep]
- 现有调用点只覆盖必要资产：movie cover、actor avatar、publisher logo、comic cover（仅在 `UPLOAD_COMIC_COVERS_TO_R2=true` 时）和 `scripts/backfill-covers.ts` 的历史 movie cover 回填。 [VERIFIED: codebase grep]
- Phase 7 已经把漫画章节正文图从主链路里移出 `ImageProcessor.process()`；现有测试明确断言：默认模式下正文图保持外链，显式开启时也只上传 cover，不处理 chapter pages。 [VERIFIED: codebase grep]
- clean reject 的正确位置是 `ImageProcessor` 边界或其紧邻 thin wrapper：调用前要求显式 `purpose`，并用 namespace rule 只允许 `cover -> movies/<code>|comics/<slug>`、`avatar -> actors/<id>`、`logo -> publishers/<id>`；对 `purpose === 'comic_chapter_page'` 或任何 `comics/<slug>/<chapter>` namespace 直接抛错并停止后续 download/upload。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]
- 只在单个 crawler caller 写 `if` 判断不够，因为 `backfill-covers.ts` 等脚本与未来新脚本仍可绕过；Phase 8 的 planner 必须把“shared contract 在 upload seam fail closed”当成 locked implementation shape，而不是把拒绝逻辑分散到多个 caller。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]

### Current mapping backup / temp prefixes and which need lifecycle or count guard

- 审计脚本当前已经把 `mappings/`、`mappings/backups/`、`tmp/`、`crawler-debug/`、`import-staging/`、`images/`、`system/`、`ops/d1-backups/`、`comics/<slug>` 与 `comics/<slug>/<chapter>` 分成独立组；Phase 8 不需要重新定义这套 taxonomy。 [VERIFIED: codebase grep]
- `MappingFileManager.uploadMapping()` 默认每次都会写主文件 `mappings/<file>.json` 和备份文件 `mappings/backups/<name>-<timestamp>.json`；`uploadUnmappedList()` 也是通过同一路径创建 payload，因此 crawler 侧当前确认的 backup series 包括 `actor-name-map`、`publisher-name-map`、`series-to-publisher-map`、`unmapped-actors`、`unmapped-publishers`。 [VERIFIED: codebase grep]
- `POST /api/admin/crawlers/add-mapping` 也会在写主 mapping 后立即写一份 `mappings/backups/<actor-name-map|publisher-name-map>-<timestamp>.json`；`GET /api/admin/crawlers/mapping-versions` 只按 `actor-name-map-` 或 `publisher-name-map-` 前缀列最近 `50` 个对象。 [VERIFIED: codebase grep]
- 当前 audit 风险塑形仍然过粗：`mappings/backups/ >= 50` 才升级 high risk，`images/ > 0` 升级 high risk，`comics/<slug>/<chapter> > 0` 直接 critical；还没有表达 `tmp/3d`、`crawler-debug/3d`、`import-staging/7d`、`mappings/backups/14d + recent 20 per series`。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]
- planning implication 很明确：`tmp/`、`crawler-debug/`、`import-staging/` 需要 age-based guard；`mappings/backups/` 需要 age-based + per-series count-based guard；`system/` 与 `ops/d1-backups/` 只做 audit inventory，不纳入本 phase 的 hard-fail cleanup list。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]

### Exact runbook and audit artifacts Phase 8 should update

- `RUNBOOK.md` 是唯一正式运维手册；它当前覆盖 deploy、rollback、D1 backup/restore、observability、crawler 告警与常见故障，但尚无 R2 成本审计、lifecycle guidance、Budget Alerts 或 accidental upload remediation 章节。 [VERIFIED: codebase grep]
- `packages/crawler/scripts/audit-r2-storage.ts` 是 Phase 8 应继续扩展的唯一 audit CLI；它已经公开了 `--dry-run`、`--strict-env`、`--md-out`、`--json-out`、`--csv-out` 等命令面，并在 metadata 中标记 `db_reference_status` 与 `noDeleteConfirmed`。 [VERIFIED: codebase grep]
- `packages/crawler/test/audit-r2-storage.test.ts` 是现有自动化验证 seam；Phase 8 只需要扩展它来覆盖新 guardrail 字段、series grouping 和 hard-failure shaping，不需要新造第二套测试入口。 [VERIFIED: codebase grep]
- `.planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md`、`.planning/phases/06-storage-policy-audit/06-r2-audit-details.json`、`.planning/phases/06-storage-policy-audit/06-r2-audit-details.csv` 是当前报告契约样本；如果 Phase 8 改了 report schema、field names 或 recommendation wording，这三份契约样本必须一起更新。 [VERIFIED: codebase grep]
- 现有最准确的 audit 运行命令已经在脚本 help 中固定，planner 可直接引用并为 Phase 8 产物命名新的输出文件：`pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts --dry-run --strict-env --md-out .planning/phases/08-cost-guardrails/08-r2-audit.md --json-out .planning/phases/08-cost-guardrails/08-r2-audit.json --csv-out .planning/phases/08-cost-guardrails/08-r2-audit.csv`。 [VERIFIED: codebase grep]

## Explicit Deferrals to Phase 9 / Phase 10

- **Deferred to Phase 9:** `AGENTS.md` 瘦身、`RUNBOOK.md` 的结构性重排、历史 phase artifact 清理与“文档谁是 source of truth”的大整理。Phase 8 只应在 `RUNBOOK.md` 上增量追加 owner-facing cost-ops 内容，不做全面重构。 [VERIFIED: ROADMAP.md] [VERIFIED: 08-CONTEXT.md]
- **Deferred to Phase 10:** `/api/upload`、presign、crawler、脚本 helper 的全面统一；`generatePresignedUrl()` 这类 dead/legacy seam 的系统性收敛；更大范围的存储 helper 命名与测试矩阵清理；以及所有上传路径的一次性大一统。Phase 8 只需保证这些历史面“不能绕过成本边界”。 [VERIFIED: ROADMAP.md] [VERIFIED: REQUIREMENTS.md] [VERIFIED: 08-CONTEXT.md]

## Architecture Patterns

### System Architecture Diagram

```text
Dashboard manual upload
  PostEditor / ImageUpload / Comics
        |
        v
  purpose-bearing upload contract
        |
        +--> [Decision] allowed manual purpose?
        |         | yes
        |         v
        |    /api/upload (serviceAuth + file validation + purpose->prefix mapping)
        |         |
        |         +--> BUCKET.put
        |         +--> media.insert
        |
        | no
        v
      4xx reject


Crawler / scripts
  movie / actor / publisher / comic cover / backfill
        |
        v
  purpose + namespace guard
        |
        +--> [Decision] chapter-page or forbidden namespace?
        |         | yes -> fail closed before download/upload
        |         v
        |       reject
        |
        | no
        v
  ImageProcessor.process()
        |
        v
      R2 upload


R2 inventory
   |
   v
audit-r2-storage.ts --dry-run
   |
   +--> Markdown / JSON / CSV reports
   +--> [Decision] incomplete DB evidence or hard-fail prefixes?
             | yes -> block cleanup/lifecycle
             | no  -> owner may apply lifecycle / remediation manually
   |
   v
RUNBOOK.md + Cloudflare Budget Alerts
```
[VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md] [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/] [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/]

### Recommended Project Structure

```text
apps/api/src/routes/upload/           # manual upload route, role gate, request/response contract
apps/dashboard/src/lib/               # typed upload client wrapper
apps/dashboard/src/views/             # PostEditor / Comics manual upload consumers
apps/dashboard/src/components/        # generic ImageUpload consumer
packages/crawler/src/lib/             # ImageProcessor + MappingFileManager + shared policy seam
packages/crawler/scripts/             # audit-r2-storage.ts and historical scripts
packages/crawler/test/                # audit guardrail tests
.planning/phases/06-storage-policy-audit/  # existing audit contract artifacts that may need schema sync
RUNBOOK.md                            # owner-facing cost audit / lifecycle / budget procedures
```
[VERIFIED: codebase grep]

### Pattern 1: Purpose-First Shared Contract

**What:** 用一个薄的本地 shared module 定义 allowed purposes、purpose 到 canonical top-level prefix 的映射、以及 crawler namespace 约束；API upload、Comics 历史上传面、crawler 和 scripts 都复用这套 contract。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]

**When to use:** 任何会新增 R2 object 的入口都必须先声明“为什么上传”，而不是直接传 `images/` 或自由 `keyPrefix`。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]

**Example:**
```typescript
// Source: apps/api/src/routes/upload/index.ts + packages/crawler/src/lib/image-processor.ts + 06-STORAGE-POLICY.md
export type UploadPurpose =
  | 'cover'
  | 'avatar'
  | 'logo'
  | 'blog_inline'
  | 'manual_asset'
  | 'fallback'
  | 'temp'

export function assertAllowedPurpose(input: {
  purpose: UploadPurpose | 'comic_chapter_page'
  namespace: string
}) {
  if (input.purpose === 'comic_chapter_page')
    throw new Error('comic_chapter_page uploads are forbidden')

  if (input.namespace.startsWith('comics/') && input.namespace.split('/').length >= 3)
    throw new Error('chapter-page namespace is forbidden')
}
```
[VERIFIED: codebase grep]

### Pattern 2: Reject Before Side Effects

**What:** 先做 purpose / namespace 判定，再允许 `bucket.put`、`generatePresignedUrl()`、`ImageProcessor.process()` 的下载或上传分支运行。 [VERIFIED: codebase grep]

**When to use:** 所有 manual upload、crawler upload、历史脚本 upload 以及任何未来恢复的 presign route。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]

**Example:**
```typescript
// Source: packages/crawler/src/lib/image-processor.ts
function guardBeforeProcess(purpose: string, namespace: string) {
  if (purpose === 'comic_chapter_page')
    throw new Error('Rejected before remote download')

  if (namespace.startsWith('comics/') && namespace.split('/').length >= 3)
    throw new Error('Rejected before R2 upload')
}
```
[VERIFIED: codebase grep]

### Anti-Patterns to Avoid

- **保留 `images/` 作为隐式 fallback:** 这会让 Phase 8 失去“新对象不能悄悄进历史泛化前缀”的根目标。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]
- **新增独立 `/upload/presign` 却不复用同一套 allowlist:** 这会让 `Comics.vue` 式旁路重新成为策略漏洞。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]
- **把 `mappings/backups/` 当成一个全局桶做 count guard:** Phase 8 锁定的是“每类映射最近 20 份”，不是“总共 20 份”。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]
- **在 `db_reference_status` 不完整时继续做 cleanup/lifecycle:** 这直接违反 D-17 的 evidence-first gate。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| prefix 过期策略 | 自写定时删除器 | Cloudflare R2 lifecycle rules + audit evidence gate | 官方已支持 prefix-scoped lifecycle；Phase 8 只需把规则和阻断条件写清。 [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/] [VERIFIED: 08-CONTEXT.md] |
| 成本预警 | 自写“估算账单”的 cron 或脚本 | Cloudflare Budget Alerts | 官方已提供按美元阈值的账期通知，且明确是 informational only。 [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/] |
| 第二个审计报表系统 | 新写独立 spreadsheet / second CLI | 扩展 `audit-r2-storage.ts` | 现有脚本已经拥有 prefix taxonomy、DB status、MD/JSON/CSV 输出和 no-delete contract。 [VERIFIED: codebase grep] |
| 手工上传旁路鉴权 | 新造 upload token 体系 | 现有 `/api/upload` + `serviceAuth` 或复用同一 policy 的窄路由 | 现成 admin role gate 已存在；Phase 8 的问题是语义过宽，不是缺 auth。 [VERIFIED: codebase grep] |

**Key insight:** Phase 8 不是“加更多工具”，而是“把已有边界强制执行起来”。最便宜也最安全的实现路径，是复用现有 route、现有 upload seam、现有 audit CLI 和现有 RUNBOOK。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]

## Common Pitfalls

### Pitfall 1: 只改 `/api/upload`，不改所有 manual consumers

**What goes wrong:** `PostEditor.vue`、`ImageUpload.vue` 或 `Comics.vue` 仍按旧合同发送请求，导致 UI 400 回归或绕过新 allowlist。 [VERIFIED: codebase grep]
**Why it happens:** 当前 manual upload surface 分散在 raw `fetch`、typed wrapper 和历史 presign 意图三条路径上。 [VERIFIED: codebase grep]
**How to avoid:** 把 route 合同变更和这 4 个 dashboard consumers 放进同一 wave，并保持响应里的 `url` 字段可直接复用。 [VERIFIED: codebase grep]
**Warning signs:** `Comics.test.ts` 仍只 mock `upload.presign`，或 `PostEditor`/`ImageUpload` 测试没有覆盖新 `purpose` 字段。 [VERIFIED: codebase grep]

### Pitfall 2: 在 crawler 里“晚拒绝”

**What goes wrong:** 被禁止的 chapter-page intent 先触发远程下载或部分 upload，再在后段失败。 [VERIFIED: codebase grep]
**Why it happens:** `ImageProcessor.process()` 现在先 `got(...).buffer()`，之后才进入变体上传流程。 [VERIFIED: codebase grep]
**How to avoid:** 把 guard 放在 `ImageProcessor` 边界或 wrapper 的入口参数校验阶段。 [VERIFIED: codebase grep]
**Warning signs:** 错误日志发生在 upload 失败之后，而不是调用前参数校验阶段。 [VERIFIED: codebase grep]

### Pitfall 3: 把 `mappings/backups/` 做成全局数量阈值

**What goes wrong:** 一类 mapping 的爆量会淹没另一类 mapping 的超限，或者误删仍需保留的最新备份。 [VERIFIED: 08-CONTEXT.md]
**Why it happens:** 当前脚本只按整个 `mappings/backups/` group 做 `>= 50` 的粗粒度升级。 [VERIFIED: codebase grep]
**How to avoid:** 按 backup stem 分组，例如 `actor-name-map`、`publisher-name-map`、`series-to-publisher-map`、`unmapped-actors`、`unmapped-publishers`。 [VERIFIED: codebase grep]
**Warning signs:** 报告里只有 group-level object count，没有 per-series recent count / overage notes。 [VERIFIED: codebase grep]

### Pitfall 4: 把不完整审计当作可以继续 cleanup/lifecycle 的证据

**What goes wrong:** 在 `missing_credentials`、`partial` 或 `missing_query_context` 状态下继续执行 lifecycle/cleanup，导致误判引用关系。 [VERIFIED: 08-CONTEXT.md]
**Why it happens:** 现有脚本本来就允许“只读 inventory + 可选 D1 查询”，不强制所有人都带全量凭据。 [VERIFIED: codebase grep]
**How to avoid:** 在报告 recommendation 和 RUNBOOK 两侧都把这三种状态写成 hard block。 [VERIFIED: 08-CONTEXT.md]
**Warning signs:** markdown 报告里出现 incomplete DB notes，但 runbook 仍写着“可继续清理/应用 lifecycle”。 [VERIFIED: codebase grep]

### Pitfall 5: 误以为 Budget Alerts 会自动封顶

**What goes wrong:** owner 以为 `$1/$3` 阈值会自动停止计费，结果真实账单仍继续增长。 [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/]
**Why it happens:** Budget Alerts 是账期累计通知，不是 usage cap。 [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/]
**How to avoid:** 在 `RUNBOOK.md` 明确写“informational only / do not pause or cap usage”。 [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/] [VERIFIED: 08-CONTEXT.md]
**Warning signs:** 文档里只写了阈值，没写 notify-only 免责声明。 [VERIFIED: 08-CONTEXT.md]

## Code Examples

Verified patterns from official or existing canonical sources. [VERIFIED: codebase grep] [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/]

### R2 lifecycle CLI
```bash
# Source: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
npx wrangler r2 bucket lifecycle list <BUCKET_NAME>
npx wrangler r2 bucket lifecycle set <BUCKET_NAME> --file <FILE_PATH>
```
[CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/]

### Prefix-scoped lifecycle JSON
```json
// Source: adapted from https://developers.cloudflare.com/r2/buckets/object-lifecycles/
{
  "Rules": [
    {
      "ID": "ExpireTmp",
      "Status": "Enabled",
      "Filter": { "Prefix": "tmp/" },
      "Expiration": { "Days": 3 }
    },
    {
      "ID": "ExpireImportStaging",
      "Status": "Enabled",
      "Filter": { "Prefix": "import-staging/" },
      "Expiration": { "Days": 7 }
    }
  ]
}
```
[CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/]

### Existing audit dry-run command
```bash
# Source: packages/crawler/scripts/audit-r2-storage.ts
pnpm --filter @starye/crawler exec tsx scripts/audit-r2-storage.ts \
  --dry-run \
  --strict-env \
  --md-out .planning/phases/08-cost-guardrails/08-r2-audit.md \
  --json-out .planning/phases/08-cost-guardrails/08-r2-audit.json \
  --csv-out .planning/phases/08-cost-guardrails/08-r2-audit.csv
```
[VERIFIED: codebase grep]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| generic `images/` admin upload | explicit purpose allowlist mapped to canonical prefixes | locked on 2026-07-13 in Phase 8 context | 阻止新的高成本对象继续写入历史泛化前缀。 [VERIFIED: 08-CONTEXT.md] |
| free-form crawler `keyPrefix` contract | purpose + namespace guard at upload seam | required by COST-02 in current roadmap | 新脚本和历史脚本都不能再靠“传字符串”绕过 policy。 [VERIFIED: REQUIREMENTS.md] [VERIFIED: codebase grep] |
| coarse `mappings/backups/ >= 50` risk bump | `14d + recent 20 per series` actionable guardrail | locked on 2026-07-13 in Phase 8 context | 把“增长风险”从口头提醒升级成 cleanup/lifecycle 的硬阻断依据。 [VERIFIED: 08-CONTEXT.md] |
| no spend notification in repo ops docs | `$1` / `$3` Budget Alerts + notify-only note | Phase 8 requirement + current Cloudflare docs | owner 能更早发现 drift，但不会误以为平台会自动停费。 [VERIFIED: 08-CONTEXT.md] [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/] |

**Deprecated/outdated:**

- 将 `Comics.vue` 的 manual cover 上传继续视作一个“以后再说的 presign 面”已经不够安全；它现在就是 Phase 8 必须处理的 bypass seam。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]
- 把 `images/` 描述成“现行允许前缀”已经过时；Phase 6 已经把它锁成 `historical risk`。 [VERIFIED: 06-STORAGE-POLICY.md] [VERIFIED: 06-R2-WRITE-INVENTORY.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | none | — | — |

All claims in this research were verified or cited during this session; no user confirmation is required before planning. [VERIFIED: codebase grep] [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/] [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/]

## Open Questions

1. **`Comics.vue` 应该回收进 `/api/upload`，还是补一个窄口径 `/upload/presign`?**
   - What we know: 当前只有前端 `api.upload.presign()` 调用，没有后端 route；context 明确允许“最小改动复用 allowlist / 显式 deny / 补 guard”，但不要求本 phase 做全面统一。 [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]
   - What's unclear: 实施时是把 UI 直接切回 `/api/upload` 更省事，还是保留 presign 但强制复用同一 policy module 更符合现有交互。 [VERIFIED: codebase grep]
   - Recommendation: planner 优先选“收回 `/api/upload`”作为默认路线；只有当 comic cover UX 明确依赖 direct-to-R2 才考虑窄口径 presign，并确保它与 `/api/upload` 共享同一 guard。 [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep]

2. **Phase 8 是只交付 lifecycle guidance，还是在 fresh audit 通过后顺手应用 live rule?**
   - What we know: requirements 只要求 guidance；context 允许组合使用 R2 lifecycle 与 runbook/script，但又要求任何 lifecycle 变更必须受 fresh audit evidence gate 约束。 [VERIFIED: REQUIREMENTS.md] [VERIFIED: 08-CONTEXT.md]
   - What's unclear: owner 是否希望这一个 phase 就在 Cloudflare bucket 上落 live rule。 [VERIFIED: 08-CONTEXT.md]
   - Recommendation: 把“guidance + audit hard-failure + runbook commands”作为必交付物，把 live lifecycle apply 设计成有 fresh audit report 才能执行的人类 checkpoint，而不是 plan 的默认 done definition。 [VERIFIED: 08-CONTEXT.md] [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | API/crawler/dashboard tests and scripts | ✓ | `v24.0.1` | — |
| `pnpm` | workspace scripts and filtered test commands | ✓ | `10.33.0` | — |
| `npm` | registry verification and `npm view` checks | ✓ | `11.3.0` | — |
| `pnpm exec wrangler` (from `apps/api`) | optional lifecycle list/set verification | ✓ | `4.90.1` | Use Dashboard UI if CLI auth is unavailable |

**Missing dependencies with no fallback:**

- Cloudflare Dashboard / Billing account access cannot be machine-verified from this terminal, but it is a human prerequisite for Budget Alerts setup and any live lifecycle rule application. [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/] [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/]

**Missing dependencies with fallback:**

- Global `wrangler` is not installed on this machine; planner must use `pnpm exec wrangler` (preferred) or the Cloudflare Dashboard UI. [VERIFIED: environment audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `Vitest` across `apps/api`, `apps/dashboard`, and `packages/crawler`; repo pin `^4.1.4`. [VERIFIED: codebase grep] |
| Config file | `apps/api/vitest.config.ts`, `apps/dashboard/vitest.config.ts`, `packages/crawler/vitest.config.ts`. [VERIFIED: codebase grep] |
| Quick run command | `pnpm --filter @starye/crawler exec vitest run test/audit-r2-storage.test.ts`. [VERIFIED: codebase grep] |
| Full suite command | `pnpm test`. [VERIFIED: AGENTS.md] [VERIFIED: codebase grep] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COST-01 | `/api/upload` requires `purpose` and rejects generic `images/` writes while preserving `url` response usage. | unit | `pnpm --filter api exec vitest run src/routes/upload/__tests__/upload-purpose.test.ts -x` | ❌ Wave 0 |
| COST-02 | crawler/shared upload seam rejects `comic_chapter_page` and forbidden `comics/<slug>/<chapter>` namespaces. | unit | `pnpm --filter @starye/crawler exec vitest run test/image-processor-purpose-policy.test.ts src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts -x` | ❌ Wave 0 |
| COST-03 | audit output exposes `3d/3d/7d/14d + recent 20` guardrails. | unit | `pnpm --filter @starye/crawler exec vitest run test/audit-r2-storage.test.ts -x` | ✅ |
| COST-04 | `RUNBOOK.md` documents repeatable R2 audit procedure and hard-failure conditions. | source assertion | `rg -n "R2 cost audit|comics/<slug>/<chapter>|images/|mappings/backups/|db_reference_status" RUNBOOK.md .planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md` | ✅ |
| COST-05 | `RUNBOOK.md` documents `$1` / `$3` Budget Alerts and notify-only semantics. | source assertion | `rg -n "Budget Alerts|\\$1|\\$3|informational only|do not pause|do not cap|notify only" RUNBOOK.md` | ✅ |

### Sampling Rate

- **Per task commit:** run the narrowest relevant Vitest command plus one source assertion for docs if the task edits `RUNBOOK.md`. [VERIFIED: codebase grep]
- **Per wave merge:** run `pnpm --filter @starye/crawler exec vitest run test/audit-r2-storage.test.ts` and any touched package tests. [VERIFIED: codebase grep]
- **Phase gate:** run `pnpm test` plus the explicit audit dry-run command before `$gsd-verify-work`. [VERIFIED: AGENTS.md] [VERIFIED: codebase grep]

### Wave 0 Gaps

- [ ] `apps/api/src/routes/upload/__tests__/upload-purpose.test.ts` — covers COST-01. [VERIFIED: codebase grep]
- [ ] `packages/crawler/test/image-processor-purpose-policy.test.ts` — covers COST-02. [VERIFIED: codebase grep]
- [ ] extend `apps/dashboard/src/views/__test__/Comics.test.ts` — stop treating `upload.presign` as the only expected path if the plan reroutes comic cover upload. [VERIFIED: codebase grep]
- [ ] extend `apps/dashboard/src/views/__test__/PostEditor.test.ts` or add focused upload contract test — assert new `purpose=blog_inline` call shape while preserving returned `url` usage. [VERIFIED: codebase grep]
- [ ] extend `packages/crawler/test/audit-r2-storage.test.ts` — add age/count hard-failure expectations for backup series and short-term prefixes. [VERIFIED: codebase grep]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | manual upload and admin crawler routes already rely on authenticated Better Auth / service-auth flows; Phase 8 must preserve that gate. [VERIFIED: codebase grep] |
| V3 Session Management | yes | dashboard manual uploads should continue to use Gateway cookie-sharing behavior and `credentials: 'include'` where applicable. [VERIFIED: AGENTS.md] [VERIFIED: codebase grep] |
| V4 Access Control | yes | `serviceAuth([...])` role allowlist on `/api/upload` and admin crawler routes. [VERIFIED: codebase grep] |
| V5 Input Validation | yes | keep MIME/size/ext validation and add explicit `purpose` / namespace schema validation. [VERIFIED: codebase grep] |
| V6 Cryptography | yes | if any presign path survives, use `@aws-sdk/s3-request-presigner`; never hand-roll signatures or token formats. [VERIFIED: codebase grep] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| purpose spoofing to privileged prefixes | Tampering / Elevation of Privilege | explicit purpose enum + canonical prefix mapper + denylist for internal prefixes. [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep] |
| presign or side-route bypass around upload policy | Elevation of Privilege | any surviving presign route must reuse the exact same allowlist/namespace guard; otherwise prefer a single `/api/upload` surface. [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md] |
| oversized or malformed image upload | Denial of Service / Tampering | preserve current 10MB, MIME, and extension checks before R2 write. [VERIFIED: codebase grep] |
| cleanup/lifecycle based on partial audit evidence | Tampering / Availability | hard block on `db_reference_status=missing_credentials|partial|missing_query_context`. [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep] |
| chapter-page storage regression | Tampering / Cost Abuse | keep `comics/<slug>/<chapter>` as explicit forbidden/highest-risk audit row and reject `comic_chapter_page` at upload seam. [VERIFIED: 08-CONTEXT.md] [VERIFIED: codebase grep] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/08-cost-guardrails/08-CONTEXT.md` — locked decisions, discretion, deferred scope, hard-failure semantics. [VERIFIED: 08-CONTEXT.md]
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — Phase 8 requirement mapping and current milestone boundary. [VERIFIED: REQUIREMENTS.md] [VERIFIED: ROADMAP.md] [VERIFIED: STATE.md]
- `apps/api/src/routes/upload/index.ts`, `apps/dashboard/src/views/PostEditor.vue`, `apps/dashboard/src/components/ImageUpload.vue`, `apps/dashboard/src/views/Actors.vue`, `apps/dashboard/src/views/Movies.vue`, `apps/dashboard/src/views/Publishers.vue`, `apps/dashboard/src/views/Comics.vue`, `apps/dashboard/src/lib/api.ts` — current `/api/upload` contract and likely consumers. [VERIFIED: codebase grep]
- `packages/crawler/src/lib/image-processor.ts`, `packages/crawler/src/crawlers/comic-crawler.ts`, `packages/crawler/src/crawlers/__tests__/comic-crawler.chapter-flow.test.ts`, `packages/crawler/src/lib/mapping-file-manager.ts`, `apps/api/src/routes/admin/crawlers/index.ts`, `packages/crawler/scripts/audit-r2-storage.ts`, `packages/crawler/test/audit-r2-storage.test.ts` — current crawler, mapping backup, and audit contract behavior. [VERIFIED: codebase grep]
- `.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md`, `06-R2-WRITE-INVENTORY.md`, `06-R2-AUDIT-DRY-RUN.md` — upstream canonical prefix policy and audit artifact contracts. [VERIFIED: codebase grep]
- `RUNBOOK.md`, `.github/workflows/deploy-migrations.yml`, `packages/db/MIGRATION.md` — current operations docs and `ops/d1-backups/` semantics. [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)

- Cloudflare R2 Object Lifecycles — prefix-scoped lifecycle rules, 24h deletion behavior, Wrangler commands, bucket-level scope. https://developers.cloudflare.com/r2/buckets/object-lifecycles/ [CITED: https://developers.cloudflare.com/r2/buckets/object-lifecycles/]
- Cloudflare Budget Alerts — account-wide usage-spend email alerts, one notification per threshold crossing, reset each billing period, informational only. https://developers.cloudflare.com/billing/manage/budget-alerts/ [CITED: https://developers.cloudflare.com/billing/manage/budget-alerts/]

### Tertiary (LOW confidence)

- none. [VERIFIED: codebase grep]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Phase 8 uses the existing repo stack and no new dependencies; current npm versions were verified separately. [VERIFIED: codebase grep] [VERIFIED: npm view]
- Architecture: HIGH - the relevant upload, crawler, audit, and runbook seams are directly visible in current repo code and locked context. [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]
- Pitfalls: HIGH - every listed pitfall is grounded in a currently observable contract mismatch or locked hard-failure rule. [VERIFIED: codebase grep] [VERIFIED: 08-CONTEXT.md]

**Research date:** 2026-07-13
**Valid until:** 2026-07-27
