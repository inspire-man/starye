---
phase: 03
slug: movie-app-r2
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-12
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser route query -> `Player.vue` | `/movie/:code/play` 接收 `player` / `streamUrl` 参数并决定是否直接初始化 xgplayer | 播放链接、影片 code、用户可见错误态 |
| movie-app -> public movie detail API | `Player.vue` / `MovieDetail.vue` 依赖 `GET /api/public/movies/:code` 决定影片可见性与可用补救动作 | 影片详情、R18 访问控制结果、播放源元数据 |
| movie-app -> 本地 / 默认 TorrServer | movie-app 读取本地配置和系统默认地址，构造 TorrServer 流地址后交给浏览器直接播放 | HTTP 流地址、磁链、文件 index |
| movie-app -> public view tracking API | 播放页进入后调用 `POST /api/public/movies/:code/view` 记录 viewCount | 影片 code、匿名/已登录访问行为 |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Elevation of Privilege | `apps/movie-app/src/views/Player.vue` `streamUrl` 直达播放路径 | mitigate | `streamUrl` 模式先强制 `movieApi.getMovieDetail(code)` 成功；403 / 失败立即停在错误态，不再继续初始化播放器。回归测试：`src/views/__tests__/Player.security.test.ts` | closed |
| T-03-02 | Tampering | `apps/movie-app/src/views/Player.vue` / `src/utils/playerSecurity.ts` | mitigate | 只接受 origin 命中本地配置或系统默认 TorrServer 的 `http/https` `/stream/video?link=...&index=...` 地址；拒绝任意外部 `streamUrl` 注入。回归测试：`src/utils/__tests__/playerSecurity.test.ts` | closed |
| T-03-03 | Authorization Bypass / Privacy | `apps/movie-app/src/views/Player.vue` -> `movieApi.trackView()` | mitigate | `trackCurrentMovieView()` 挪到详情授权与 `streamUrl` 校验通过后再执行，避免未授权直达播放页也计入 viewCount。回归测试：`src/views/__tests__/Player.security.test.ts` | closed |
| T-03-04 | Information Disclosure | `apps/api/src/routes/public/movies/index.ts` + `apps/movie-app/src/views/MovieDetail.vue` / `Player.vue` | mitigate | Phase 2 的服务端 R18 detail 403 继续作为唯一硬防线；Phase 3 仅消费该结果，不自行兜底放行。人工 UAT 第 5 项与本次播放器安全回归共同确认未回退。 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-12 | 4 | 4 | 0 | Codex (`$gsd-secure-phase 3`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-12
