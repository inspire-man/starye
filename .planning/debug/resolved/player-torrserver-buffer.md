---
status: resolved
trigger: TorrServer 流已经有可读 Range 数据，但 Player 在缓冲阶段先显示失败，随后媒体实际进入播放。
created: 2026-08-18
updated: 2026-08-18
---

## Symptoms

- Gateway 播放页使用真实 MUDR-392 TorrServer 流。
- `<video>` 采样显示 `paused=false`、`currentTime≈23.9s`、`buffered≈24.5s`、`error=null`。
- Player 在首次 `waiting` 后 10 秒进入 `TorrServer 缓冲超时`。
- `canplay` 和 `playing` 约在 15 秒才到达，页面状态已经是 failed。

## Current Focus

- hypothesis: TorrServer 冷启动的首段缓冲超过通用 10 秒 watchdog，导致应用失败状态早于媒体恢复事件。
- test: 延长 TorrServer 的有界缓冲窗口，并验证延迟 canplay/playing 后页面保持可恢复状态。
- expecting: 真实媒体尚未进入播放时继续有界失败；媒体在窗口内启动时不再出现“媒体播放、页面失败”。
- next_action: resolved; keep the bounded TorrServer window and monitor fresh Gateway playback tuples.

## Evidence

- timestamp: 2026-08-18 Gateway browser
  - media state: `readyState=2`, `networkState=2`, `paused=false`, `currentTime=23.930725`, `buffered=[0,24.490833]`, `error=null`.
  - UI state: `TorrServer 缓冲超时`; `canplay/playing` observed at 15000ms; `waiting` observed at 6ms.
- timestamp: 2026-08-18 Gateway regression after fix
  - after refresh and visible play, UI reached `播放进度已推进 · 播放已验证`.
  - `canplay` and `playing` observed; `currentTime` advanced from `30.002631` to `32.60891`; media remained `paused=false` with `error=null`.

## Eliminated

- hypothesis: TorrServer HTTP 流本身不可读
  - reason: previous real probe returned `206 video/mp4` Range data and current browser video progressed.
- hypothesis: media element received a terminal media error
  - reason: current browser sample returned `error=null`.

## Resolution

- root_cause: TorrServer cold-start buffering exceeded the shared 10-second watchdog, so the application marked failure before delayed media readiness and playback events arrived.
- fix: Player now uses a bounded 30-second TorrServer buffering and playback-observation window; direct sources retain the existing 10/15-second windows. Public availability readback tuples now accept local-proof while playback-evidence submission remains GitHub-only.
- verification: Player security tests 20/20, Movie App tests 215/215, vue-tsc, targeted lint, production build with a temporary local Pages env, and fresh Gateway playback all passed.
- files_changed: apps/movie-app/src/views/Player.vue; apps/movie-app/src/views/__tests__/Player.security.test.ts; apps/movie-app/src/types.ts
