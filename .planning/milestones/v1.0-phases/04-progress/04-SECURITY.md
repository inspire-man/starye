---
phase: 04
slug: progress
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-13
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser -> `/api/public/progress/*` | 登录用户从 movie/comic 前端读写个人进度，包含高频播放器/阅读器事件 | userId 作用域下的影片/章节进度、完成状态、位置、时间 |
| API -> D1 `progress` | 统一 `progress` 表承载 movie + comic 的个人历史，必须按 `(userId, contentType, contentId)` 正确隔离 | 统一进度记录、history 查询结果 |
| Anonymous browser -> protected progress routes | 匿名用户可见进度入口，但不得读取任何个人历史，只能被重定向到登录页 | `next` 跳转参数、受保护页面路径 |
| Migration operator -> local D1 schema | Phase 4 通过 cutover migration 删除旧表并启用统一表 | `progress` 表 schema、旧表/旧索引退场状态 |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | `apps/api/src/routes/public/progress/index.ts` history / single lookup | mitigate | 所有 `/public/progress/*` route 统一先校验 `user`，未登录返回 `401 需要登录`；查询条件均以 `progress.userId = user.id` 作为前缀，不暴露共享历史。 | closed |
| T-04-02 | Tampering | unified progress upsert conflict target | mitigate | 统一使用 `(userId, contentType, contentId)` 作为 `onConflictDoUpdate` target，避免不同内容或不同内容类型互相覆盖。 | closed |
| T-04-03 | Repudiation | hard cutover 后旧进度丢失 | accept | 本 phase 已明确锁定不迁移旧 `reading_progress` / `watching_progress`；风险接受通过 plan/UAT 文档显式记录，不做误导性兼容或假恢复提示。 | closed |
| T-04-04 | Information Disclosure | old table dual-read path residue | mitigate | `schema.ts`、`progress route`、`progress tests` 和推荐历史查询均已切到统一 `progress` 表，主代码路径不再 import/read 旧表。 | closed |
| T-04-05 | Information Disclosure | movie history / continue rail UI | mitigate | movie 端历史与继续观看只消费当前登录用户的 `/public/progress/watching` 返回，不做本地拼接他人记录，不缓存跨用户历史。 | closed |
| T-04-06 | Tampering | `streamUrl` / TorrServer progress pollution | mitigate | `Player.vue` 读取 `streamUrl` 前仍要求通过详情 API 与受信任 TorrServer origin 校验；进度归档继续绑定 `movieCode`，不按播放源 URL 建立独立身份。 | closed |
| T-04-07 | Repudiation | movie completed 被本地猜测导致错判 | mitigate | Home / History / Profile 改为显式读取 `completed`，移除 `progress >= 3600` 和 `< 0.9` 的旧本地推断路径。 | closed |
| T-04-08 | Denial of Service | movie 高频 `timeupdate` 写库 | mitigate | `Player.vue` 采用 10 秒 checkpoint + `pause` / `seeked` / `pagehide` / `ended` flush，并设置 `<30s` 不写入。 | closed |
| T-04-09 | Tampering | wrong chapter identity in Reader | mitigate | `Reader.vue` 改为使用后端真实 `chapter.id` 作为 progress identity，禁止 `${slug}-${chapterId}` 继续污染 unified table。 | closed |
| T-04-10 | Denial of Service | comic scroll 高频写库 | mitigate | comic 端改为 500ms debounce + `pagehide` flush，不在每次 scroll frame 上报。 | closed |
| T-04-11 | Repudiation | comic completed reopen ambiguity | mitigate | `completed` 显式持久化；读取逻辑规定“完成后重开回第一页，但存储位置仍保留最后页”，并已通过 UAT 验证。 | closed |
| T-04-12 | Information Disclosure | comic Profile history access | accept | comic Profile 仍通过路由门控要求登录；不额外扩展匿名兜底视图，风险接受为“由 route guard 收口”。 | closed |
| T-04-13 | Spoofing | protected progress route auth gate | mitigate | `movie-app` / `comic-app` 路由守卫统一复用 `useAuthGuard(nextPath?)`，匿名访问 `/history` / `/profile` 直接跳 `/auth/login?next=...`。 | closed |
| T-04-14 | Repudiation | migration 完成但旧表残留 | mitigate | 手写 cutover migration `[0026_unified_progress_cutover.sql](D:/my-workspace/starye/packages/db/drizzle/0026_unified_progress_cutover.sql)` 显式创建 `progress` 并 drop 旧表/旧索引；`04-HUMAN-UAT.md` 也要求验证旧表退场。 | closed |
| T-04-15 | Information Disclosure | anonymous user sees stale personal progress UI | mitigate | Phase 4 进度入口与页面统一跳登录，不再只弹 toast/warning 并停留在原页面。 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Threat ID | Risk | Rationale |
|-----------|------|-----------|
| T-04-03 | 旧进度不会迁移 | 这是 Phase 4 的已锁定产品决策：hard cutover，不保留兼容层。 |
| T-04-12 | comic Profile 不提供匿名伪空态 | 由 route guard 统一收口，避免新增第二套匿名视图语义。 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-13 | 15 | 15 | 0 | Codex (`$gsd-secure-phase 4`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-13
