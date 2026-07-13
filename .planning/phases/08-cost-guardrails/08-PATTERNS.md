# Phase 8: Cost Guardrails - Patterns

**Mapped:** 2026-07-13
**Purpose:** 给 Phase 8 的执行阶段提供最接近的实现模式、测试挂点和文件边界，避免把 cost guardrails 做成一次失控重构。

## Pattern Summary

Phase 8 最值得复用的模式不是“某个现成 purpose allowlist 文件”，因为仓库里还没有这种 contract；真正可复用的是：

- Hono route 内做 schema / auth / side-effect sequencing 的方式
- dashboard 通过 `api.ts` 包装 multipart 或 JSON 调用的方式
- crawler 通过单一 boundary class (`ImageProcessor`) 集中处理远端下载与 R2 上传的方式
- `audit-r2-storage.ts` 这类“配置表 + pure helper + report renderer + Vitest contract test”脚本形态
- RUNBOOK 当前的分章节运维文档风格

## API Route Patterns

| Target Area | Closest Analog | Reuse Guidance |
|-------------|----------------|----------------|
| `apps/api/src/routes/upload/index.ts` purpose guard | `apps/api/src/routes/admin/chapters/index.ts` + `handlers.ts` | 如果 upload route 逻辑继续膨胀，优先按“route 壳 + helper / handler”拆开，而不是把更多条件直接堆在 `upload.post()` 闭包里。 |
| multipart 校验 + JSON 错误响应 | `apps/api/src/routes/upload/index.ts` 现有实现 | 保留现有 Hono parseBody / MIME / size 校验骨架；只替换“key 生成规则”和“缺少 purpose 的处理”。 |
| presign helper 位置 | `apps/api/src/lib/r2.ts` | 这里已经有 `generatePresignedUrl()`，说明“生成签名 URL”应被视为独立 infra helper；但如果继续使用它，必须先有 narrow purpose contract，而不是 generic filename route。 |
| admin route tests | `apps/api/src/routes/admin/chapters/__tests__/integrity-check.test.ts`、`apps/api/src/routes/admin/sync/__tests__/handlers.test.ts` | 新的 upload route tests 更适合沿用这种 route-level Vitest 风格：mock env / mock db / assert status + payload，而不是只做 source assertion。 |

## Dashboard Consumer Patterns

| Target Area | Closest Analog | Reuse Guidance |
|-------------|----------------|----------------|
| generic multipart upload client | `apps/dashboard/src/lib/api.ts::upload.uploadImage` | 不要让组件各自拼 multipart；把 `purpose` 作为 client helper 的显式参数或 prop，由 helper 统一 append 到 `FormData`。 |
| 富文本图片上传 consumer | `apps/dashboard/src/views/PostEditor.vue` | 这里已经有 editor 自定义上传逻辑，Phase 8 只需把 `purpose=blog_inline` 带进去，不需要改编辑器框架。 |
| generic asset upload consumer | `apps/dashboard/src/components/ImageUpload.vue` | 组件层适合增加 `purpose` prop 和默认值（如 `manual_asset`），保持调用点简洁。 |
| comic cover manual upload | `apps/dashboard/src/views/Comics.vue` | 这个文件是历史侧门的真实 consumer。Phase 8 最小变更应是把它收回 `upload.uploadImage(file, 'cover')`，而不是继续扩散 presign contract。 |
| dashboard test hook | `apps/dashboard/src/views/__test__/Comics.test.ts` | 已经有针对 `api.upload.presign` 的 mock，说明这里是 Phase 8 改 consumer contract 的自然回归点。 |

## Crawler / Storage Boundary Patterns

| Target Area | Closest Analog | Reuse Guidance |
|-------------|----------------|----------------|
| centralized upload boundary | `packages/crawler/src/lib/image-processor.ts` | 所有 crawler / script 图像写入都汇总到这里；purpose enforcement 最适合挂在这个边界或其紧邻 helper 上。 |
| explicit option wiring | `packages/crawler/src/index.ts::getComicCrawlerOptions()` | Phase 7 已用这个入口承载 `uploadCoversToR2`。Phase 8 如果需要新的 opt-in / guard flag，优先沿用此模式而不是散落读取 env。 |
| separated cover helper | `packages/crawler/src/crawlers/comic-crawler.ts::storeComicCoverIfEnabled()` | 这证明“cover 与 chapter page 分流”已经是现成 pattern。Phase 8 应在此基础上再加 purpose guard，而不是重新设计 comic cover 上传路径。 |
| actor / publisher / movie cover call sites | `actor-crawler.ts`、`publisher-crawler.ts`、`optimized-crawler.ts` | 这些 call site 都是 `ImageProcessor.process()` 的真实现网入口。执行时不要只改 comic crawler。 |
| legacy script surface | `packages/crawler/scripts/backfill-covers.ts` | 这是非主链路但仍会写 R2 的脚本。Phase 8 必须显式纳入，哪怕只是让它走相同 purpose guard。 |

## Audit Script Patterns

| Target Area | Closest Analog | Reuse Guidance |
|-------------|----------------|----------------|
| prefix classification table | `packages/crawler/scripts/audit-r2-storage.ts::GROUP_CONFIGS` | Phase 8 的 retention/count guard 最适合继续走“配置表驱动”，避免把阈值写死在分散的 if 分支里。 |
| pure helper + contract tests | `packages/crawler/test/audit-r2-storage.test.ts` | 新增 age/count hard-failure 逻辑时，应先扩充纯 helper / row assessment 测试，而不是只依赖人工 dry-run。 |
| read-only ops contract | `06-VERIFICATION.md` + `audit-r2-storage.ts` help text | Phase 8 可以强化 audit blocking rules，但不应引入 delete / lifecycle apply 的实际代码路径。 |

## Documentation Patterns

| Target Area | Closest Analog | Reuse Guidance |
|-------------|----------------|----------------|
| owner-facing ops chapter | `RUNBOOK.md` 的 D1 Migration Safety 章节 | R2 cost guardrails 章节应沿用“规则 -> 步骤 -> smoke / restore / 注意事项”的组织方式，而不是写成零散 FAQ。 |
| policy source of truth | `.planning/phases/06-storage-policy-audit/06-STORAGE-POLICY.md` | Phase 8 文档必须引用这里的 prefix vocabulary，不要重新发明另一套前缀命名。 |
| verification artifact style | `.planning/phases/06-storage-policy-audit/06-VERIFICATION.md`、`07-VERIFICATION.md` | Phase 8 未来 closeout 时的验证命令和阻断条件可以复用这种“command table + residual notes”风格。 |

## Execution Notes

1. 如果 Phase 8 需要一个 shared purpose contract，优先做“小 contract 文件 + caller imports”，不要顺手把所有 storage helper 都抽象成新框架。
2. `Comics.vue` 的 presign mock 已经暴露出 consumer contract 漂移，执行时要么改成 purpose-based upload，要么补一个同样受 allowlist 约束的 route，不能两边都半套。
3. audit 脚本的增强重点是“能明确告诉 owner 什么时候不能 cleanup / lifecycle”，不是“立刻自动清理对象”。
