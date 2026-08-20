---
quick: 260820-3sf-torrserver-gateway-cors
phase: 26-video-source-and-magnet-availability
plan: 260820-3sf
date: 2026-08-20
status: complete
branch: main
verified: 2026-08-20
requirements: [VID-03, VID-04, VID-05]
subsystem: gateway-playback
tags: [gateway, torrserver, playback, cors, dashboard]
duration: 8h
completed: 2026-08-20
---

# TorrServer Gateway 代理与真实播放验收

本 quick task 关闭了 Phase 26 的 Gateway 跨源播放缺口：控制面仍使用原 TorrServer 地址，最终媒体流默认经过 canonical Gateway；播放器只信任精确的受控流路径，真实消费证据绑定 fresh movie/source revision tuple。

## Delivered

- Gateway 增加固定目标 `/torrserver/stream/video` 流代理：保留 Range、206、Content-Range、video/mp4 和流式 body，返回 bounded CORS 与 `Cache-Control: no-store`，不进入 KV 缓存，也不接受调用方提供 upstream target。
- Movie App 将 system-default TorrServer 的 control base 与 Gateway media-stream base 分离；显式保存的 `serverUrl` 仍保持直连控制和媒体流行为。
- Player 仅接受 Gateway `/torrserver/stream/video` 或显式 TorrServer `/stream/video` 的精确路径，并继续要求 HTTP(S)、无 URL credentials、`link` 与 `index` 参数。
- Playback evidence 接受 `check_video_source`、`recheck_video_source`、`repair_video_source` 的视频 receipt，并要求同 revision 的 source state 完全一致；Dashboard readiness 优先显示 accepted playback evidence。

## Fresh browser and authoritative readback

通过 `http://localhost:8080` 验证未改变的 `MUDR-392` tuple：

| 字段 | 值 |
|---|---|
| movieId / sourceRevision | `f6b4b329-1f14-46c1-ab78-cba2f7c84c12` / `2` |
| taskId | `54f52d3d-99f1-423a-80e6-8a8d3b7df086` |
| runId / attempt | `9ab96173-79af-45e2-a4eb-9cda7458cb81` / `1` |
| provider | `local-proof` |
| media events | `canplay=true`, `playing=true`, `error=false` |
| positive progress | `currentTimeDelta=55.267709` |
| accepted status | `playback_verified` |

Gateway Range 响应为 `206`、`video/mp4`，带 `Content-Range`、CORS 和 `no-store`。同一 tuple 已从 Admin、Public 和 Dashboard 读回；Dashboard 显示 `Actual playback`、`播放已验证` 及完整 tuple。截图：`output/playwright/phase26-dashboard-playback.png`。

## Verification

- Gateway focused suite：62/62；Movie App 定向 suite：56/56；全量相关 suite：228/228。
- API playback-evidence repository：8/8；API 全量：81 files / 616 tests；Dashboard Crawlers：25/25。
- API、Gateway、Crawler、Dashboard、Movie App type-check，目标文件 lint，`git diff --check` 均通过。
- GitNexus index 已刷新至 21,772 nodes / 31,148 edges / 300 flows；提交前 detect-changes 仅覆盖本 quick task 的 Gateway、Movie App、playback evidence 与 Dashboard symbols/flows。

## Commits

| Commit | Description |
|---|---|
| `b990a93` | Gateway TorrServer fixed-target stream proxy |
| `5218e10` | Separate TorrServer control and media bases |
| `817f403` | Enforce exact trusted stream paths |
| `e5f17c4` | Accept video-task playback evidence |
| `b1384cd` | Surface accepted playback evidence in Dashboard |

## Residual

Vite build 仍受本地 `STARYE_PAGES_BUILD_ENV_PATH` 环境变量缺失阻塞；其余 focused/full tests、type-check、lint、diff 和 live browser/readback 证据均已通过。工作树中除本 quick task 文档外的既有改动均保持不变。
