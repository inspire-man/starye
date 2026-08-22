---
phase: 26-video-source-and-magnet-availability
plan: 26-08
subsystem: gateway-provider-live-acceptance
tags: [gateway, torrserver, playback, browser, authoritative-readback]
status: complete
requires:
  - phase: 26-06
    provides: Dashboard and typed MovieDetail four-layer projection/actions
  - phase: 26-07
    provides: revision-bound Player consumption evidence
  - phase: 26-09
    provides: real direct and magnet runner wiring
  - phase: 26-10
    provides: public authoritative movie availability readback
provides:
  - fixed-target canonical Gateway TorrServer streaming and CORS acceptance
  - exact stream trust boundary for system-default and explicit TorrServer modes
  - fresh browser playback evidence with same-revision Admin/Public/Dashboard readback
affects: [phase-27-comic-chapter-completeness, phase-28-chapter-image-availability]
requirements-completed: [VID-01, VID-02, VID-03, VID-04, VID-05]
metrics:
  tasks: 2
  files: 0
  completed: 2026-08-20
duration: 8h
completed: 2026-08-20
---

# Phase 26 Plan 08: Canonical Gateway and Playback Acceptance Summary

Phase 26 的 blocking live checkpoint 已通过。固定目标 TorrServer 流代理、Movie App 控制/媒体地址分离、精确路径信任和真实消费证据共同闭合了从 canonical Gateway 到权威 readback 的视频可用性链路。

## Acceptance tuple

使用 unchanged fresh tuple `MUDR-392`：

- movieId：`f6b4b329-1f14-46c1-ab78-cba2f7c84c12`
- sourceRevision：`2`
- task/run/attempt：`54f52d3d-99f1-423a-80e6-8a8d3b7df086` / `9ab96173-79af-45e2-a4eb-9cda7458cb81` / `1`
- provider：`local-proof`
- browser proof：`canplay=true`、`playing=true`、`error=false`、`currentTimeDelta=55.267709`
- accepted playback status：`playback_verified`

Gateway `/torrserver/stream/video` 的 Range 请求返回 `206`、`video/mp4`、`Content-Range`、CORS 和 `Cache-Control: no-store`。Playback evidence 写入后，Admin API、`GET /api/public/movies/MUDR-392` 和 Dashboard 均读回同一 movie/source/task/run/attempt/provider tuple；Dashboard readiness 显示 `Actual playback` 与 `播放已验证`。

## Automated verification

- API playback-evidence repository：8/8；API 全量：81 files / 616 tests。
- Dashboard Crawlers：25/25；Gateway focused：62/62；Movie App 定向：56/56；相关全量：228/228。
- API、Gateway、Crawler、Dashboard、Movie App type-check，目标 lint，`git diff --check` 和 GitNexus detect-changes 均通过。

## Implementation commits

实现由 quick task `260820-3sf-torrserver-gateway-cors` 交付：`b990a93`、`5218e10`、`817f403`、`e5f17c4`、`b1384cd`。

## Decisions and residuals

- stream readiness、metadata/direct/magnet availability 和 actual playback 仍是独立事实；Range、206、canplay 或 URL 构造本身都不会提升 playback readiness。
- evidence 只保存 bounded event、revision 和 server-owned tuple，不保存 magnet/stream URL、credentials、cookies、raw headers 或 media bytes。
- Vite build 仍受本地 `STARYE_PAGES_BUILD_ENV_PATH` 环境变量缺失阻塞；该环境问题不影响已通过的测试、类型检查、lint、Gateway 浏览器和三方 readback 证据。

## Phase readiness

Phase 26 的 10/10 plans 已完成，VID-01 至 VID-05 的实现与 live acceptance 均有记录；后续可进入 Phase 27 的漫画章节完整性规划。
