# Phase 8: Cost Guardrails - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 把 v1.1 的存储成本边界从“文档和前置约束”推进到“运行时护栏”。本 phase 需要收紧 `/api/upload` 与 crawler 主链路的 R2 purpose allowlist，明确短期/备份前缀的生命周期窗口，定义 `audit-r2-storage` 与 `RUNBOOK` 的成本审计失败条件和 Budget Alerts 阈值，让新的高成本对象不再悄悄进入 R2，也让后续 cleanup 或 lifecycle 变更必须建立在完整审计证据上。

本 phase 不做历史对象删除，不做默认图片代理，不做所有上传路径的一次性大统一，也不提前做 Phase 9 的文档重构或 Phase 10 的共享存储 helper 大整理。

</domain>

<decisions>
## Implementation Decisions

### Purpose Allowlist and Entry Boundaries
- **D-01:** `/api/upload` 使用业务化且窄口径的 purpose 字典，不再暴露泛化 `images/` 上传语义。
- **D-02:** 通用上传入口只服务人工资产和少量明确用途；`mappings/`、`mappings/backups/`、`import-staging/`、`crawler-debug/`、`ops/d1-backups/` 这类内部前缀不得暴露给 `/api/upload`。
- **D-03:** 富文本正文插图保留单独 purpose `blog_inline`，不得与通用 `manual_asset` 混用。
- **D-04:** 人工上传 purpose 采用少量业务化名称，而不是每个模型一个 purpose。下游规划应保持清晰但避免字典膨胀。
- **D-05:** Phase 8 先收紧 `/api/upload` 与 crawler 主链路；像 comic cover presign 这类历史或旁路上传面只要求“不能绕过成本边界”，彻底统一留到 Phase 10。

### Lifecycle Guardrails
- **D-06:** `tmp/` 的默认保留窗口是 3 天。
- **D-07:** `crawler-debug/` 的默认保留窗口是 3 天。
- **D-08:** `import-staging/` 的默认保留窗口是 7 天。
- **D-09:** `mappings/backups/` 的默认保留窗口是 14 天。
- **D-10:** `mappings/backups/` 除了按时间清理，还要加数量护栏：每类映射只保留最近 20 份。
- **D-11:** `tmp/`、`crawler-debug/`、`import-staging/` 应作为明确的自动过期目标；`mappings/backups/` 需要“14 天 + 每类最近 20 份”的审计/清理护栏。

### Audit and Budget Operations
- **D-12:** 以下情况属于硬失败，`RUNBOOK` 和审计流程必须要求处理：`comics/<slug>/<chapter>` 仍有新对象增长；通用上传仍写入泛化 `images/`；`mappings/backups/` 超过 14 天或超过每类最近 20 份；`tmp/`、`crawler-debug/`、`import-staging/` 存在过期对象。
- **D-13:** `system/` 与 `ops/d1-backups/` 先作为审计项记录，不在本 phase 自动判为硬失败；它们仍需要保留 operations 视角的分类和审查。
- **D-14:** Cloudflare Budget Alerts 采用双阈值：月度累计花费达到 `$1` 时预警，达到 `$3` 时升级提醒。
- **D-15:** `RUNBOOK` 必须明确写出 Budget Alerts 只负责通知，不会自动阻止计费。
- **D-16:** `audit-r2-storage` 以手动主导为主，但在存储策略相关改动、cleanup、migration、批量导入前必须先跑一次审计。
- **D-17:** 如果审计结果存在 `db_reference_status=missing_credentials`、`partial` 或 `missing_query_context`，则对 cleanup、删除、lifecycle 变更一律阻断；没有完整审计证据时只能继续读、看、记，不能执行实际清理动作。

### the agent's Discretion
- 规划阶段可在不偏离上述约束的前提下，细化最终 purpose 枚举命名，例如把封面类拆成 `post_cover`、`movie_cover` 等少量明确业务名，但不得回退成泛化 `images/` 或把内部前缀暴露给 `/api/upload`。
- 对 comic cover presign 或其他历史上传路径，执行方案可采用最小改动的“复用 allowlist / 显式 deny / 补 guard”方式，只要它们不能绕过成本边界，且不把 Phase 10 的全面统一提前拉进本 phase。
- 生命周期执行可组合使用 Cloudflare R2 lifecycle 与脚本/运行手册清理约束；但 count-based 的 `mappings/backups/` 护栏必须保留为可执行规则，而不是纯口头建议。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and Phase Boundaries
- `.planning/PROJECT.md` — v1.1 的免费额度目标、R2 用途边界，以及“purpose allowlist”“禁止默认图片代理”的项目级约束。
- `.planning/REQUIREMENTS.md` — Phase 8 requirements `COST-01` through `COST-05`，以及与后续文档/代码整理 phase 的边界。
- `.planning/ROADMAP.md` — Phase 8 goal、success criteria，以及与 Phase 9 / Phase 10 的明确分界。
- `.planning/STATE.md` — 当前 milestone 进度、Phase 6/7 继承决策，以及 `P8 kick-off` 的已记录关注点。
- `.planning/research/SUMMARY.md` — Cloudflare 成本研究结论、Budget Alerts 入口、`images/` 与 `mappings/backups/` 的风险提醒。

### Prior Locked Decisions
- `.planning/phases/06-storage-policy-audit/06-CONTEXT.md` — allowlist vocabulary、short-term / restricted / forbidden 分类，以及 no-delete / no-proxy 的前置边界。
- `.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md` — canonical prefix 分类，是 Phase 8 lifecycle 和 audit guard 的上游合同。
- `.planning/phases/06-storage-policy-audit/06-R2-WRITE-INVENTORY.md` — live repo 已知 R2 写入入口、writer、caller、prefix 证据表。
- `.planning/phases/06-storage-policy-audit/06-R2-AUDIT-DRY-RUN.md` — dry-run 报告字段与 risk row contract，Phase 8 的失败条件和 runbook 步骤应复用其术语。
- `.planning/phases/07-comic-external-image-flow/07-CONTEXT.md` — 章节正文图永不再进 R2、封面与正文图彻底分流、API/Reader 不再假设同源/R2 的锁定决策。

### Upload and Crawler Surfaces
- `apps/api/src/routes/upload/index.ts` — 当前 `/api/upload` 仍直接写入 `images/`，是 Phase 8 的主收紧入口。
- `apps/dashboard/src/views/PostEditor.vue` — blog 正文插图的直接上传 consumer，需要 `blog_inline` purpose。
- `apps/dashboard/src/components/ImageUpload.vue` — dashboard 通用图片上传组件入口。
- `apps/dashboard/src/lib/api.ts` — dashboard 对 `/upload` 与 `presign` 的客户端调用边界。
- `apps/dashboard/src/views/Comics.vue` — comic cover 的历史 presign consumer；本 phase 不要求彻底统一，但必须保证它不能绕过成本边界。
- `packages/crawler/src/lib/image-processor.ts` — crawler 侧图片上传主入口，Phase 8 需要与 API 共享同一套 purpose guard 语义。
- `packages/crawler/src/lib/mapping-file-manager.ts` — `mappings/` 与 `mappings/backups/` 的自动写入与备份生成逻辑。
- `apps/api/src/routes/admin/crawlers/index.ts` — 手动添加 mapping 时会创建 `mappings/backups/`，是 backup count/retention guard 的另一条写入链路。
- `packages/crawler/scripts/backfill-covers.ts` — 历史脚本级 R2 上传面；若纳入本 phase，必须服从同一成本边界。

### Audit and Operations
- `packages/crawler/scripts/audit-r2-storage.ts` — prefix class、risk shaping、DB reference status contract，以及 Phase 8 审计/失败条件的直接基础。
- `RUNBOOK.md` — Budget Alerts、R2 审计步骤、cleanup/remediation 操作说明的目标落点。
- `.github/workflows/deploy-migrations.yml` — `ops/d1-backups/` 对象的实际写入来源，说明其属于 operations backup inventory。
- `packages/db/MIGRATION.md` — D1 backup object 的使用和恢复背景，帮助区分 operations backup 与普通短期前缀。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/routes/upload/index.ts` 已集中处理 multipart 解析、MIME/size 校验、R2 Worker binding 写入和 `media` 元数据插入，适合作为 API-side purpose gate 的主落点。
- `packages/crawler/src/lib/image-processor.ts` 已集中承载 crawler/script 侧图片上传，是 crawler-side purpose guard 的主落点。
- `packages/crawler/src/lib/mapping-file-manager.ts` 与 `apps/api/src/routes/admin/crawlers/index.ts` 已经把 mapping 主文件和 `mappings/backups/` 备份写入分开，适合直接挂 retention/count guard。
- `packages/crawler/scripts/audit-r2-storage.ts` 已内建 prefix 分类、risk level、DB reference status 和 high-risk row shaping，Phase 8 更适合在此基础上补 runbook/guard 条件，而不是另造一套审计术语。
- `RUNBOOK.md` 已经是部署、回滚、D1 backup 的正式运维入口，适合作为 R2 cost audit、Budget Alerts、accidental upload remediation 的统一落点。

### Established Patterns
- R2 写入路径现在分散在 Worker binding（`BUCKET.put`）与 crawler/scripts 的 S3-compatible SDK 两侧；Phase 8 应优先统一“purpose vocabulary / allowed-vs-forbidden semantics”，而不是急于把 helper 彻底合并。
- `images/` 已在 Phase 6 审计产物中被定性为 historical risk，不应继续作为未来上传目的的泛化 prefix。
- `mappings/backups/` 已被明确标成 growth risk；它的成本风险来自“持续小文件增长”，所以仅靠 allowlist 不够，必须加 retention/count guard。
- `ops/d1-backups/` 属于 migration restore material，不是普通业务资产；Phase 8 只能把它纳入审计/说明，不应粗暴套用普通临时前缀规则。
- 本 milestone 的 cleanup 原则仍是 evidence-first：没有完整审计证据时，优先阻断实际清理动作，而不是做“猜测性安全”变更。

### Integration Points
- `dashboard manual upload -> /api/upload -> R2 + media` 是人工资产上传的主链路。
- `crawler/scripts -> ImageProcessor -> R2` 是自动写入目的控制的主链路。
- `admin mapping edits / crawler mapping sync -> mappings/ + mappings/backups/` 是 backup growth guard 的直接落点。
- `deploy-migrations.yml -> ops/d1-backups/` 是 operations backup inventory 的独立写入链路。
- `audit-r2-storage.ts -> RUNBOOK steps -> Budget Alerts` 共同组成 Phase 8 的审计与预警操作面。

</code_context>

<specifics>
## Specific Ideas

- `blog_inline` 必须和 `manual_asset` 分开，避免博客正文图与其他人工资源混成一类。
- Phase 8 的 hard failure 集合要偏硬，不给 `images/` 或 `comics/<slug>/<chapter>` 这类越界 prefix 留灰色空间。
- `mappings/backups/` 需要时间和数量双护栏：14 天 + 每类最近 20 份。
- Budget Alerts 使用 `$1` / `$3` 双阈值，并明确只是提醒，不具备“自动封顶”效果。
- 关键存储变更、cleanup、migration、批量导入前必须先跑审计；缺少完整 DB reference 证据时，一律阻断 cleanup / lifecycle 变更。

</specifics>

<deferred>
## Deferred Ideas

- `/api/upload`、presign、crawler、脚本 helper 的全面统一与共享存储 contract 收敛，留到 Phase 10。
- `system/` 与 `ops/d1-backups/` 的更完整 operations 分类、长期 retention 策略和更细粒度告警规则，留给后续 operations / cleanup 相关 phase。
- 固定周期自动运行审计（例如周跑/月跑）的自动化，如果以后需要，可作为后续 operations 能力再立项；本 phase 先采用“手动主导 + 关键变更前强制”。

</deferred>

---

*Phase: 8-Cost Guardrails*
*Context gathered: 2026-07-13*
