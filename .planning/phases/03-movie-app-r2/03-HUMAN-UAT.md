---
status: complete
phase: 03-movie-app-r2
source: [03-VALIDATION.md]
started: 2026-05-12
updated: 2026-05-12T17:59:37+08:00
---

## Current Test

[testing complete]

## Tests

### 1. 离线按钮反馈
expected: Aria2 未连接时，MovieDetail 的 `Aria2` 按钮仍可见但为 disabled，title 为“aria2 未连接，请先在设置中配置”或等价文案；TorrServer 未连接时“在线播放”按钮仍可见但为 disabled，title 明确提示 TorrServer 未连接。
result: [passed] 2026-05-12 — 在 `http://localhost:8080/movie/movie/BDSR-553` 验证通过；`Aria2` 与 `在线播放` 按钮均可见、disabled，浏览器快照显示 description 分别为“aria2 未连接，请先在设置中配置”和“TorrServer 未连接，请先在设置中配置”。

### 2. 标准播放源错误可见化
expected: 打开一个已知无效或失效的普通 `player.sourceUrl`，Player 页面不再停留在无反馈黑屏，而是显示统一错误卡片，至少包含：错误说明、重试按钮、返回详情页按钮。
result: pass

### 3. TorrServer 路径错误可见化
expected: 在 TorrServer 模式下制造加载失败或播放失败（例如服务端断开、格式不支持或流无效），原有专用 overlay 被统一错误卡片取代；若当前影片有 magnet 且 Aria2 已连接，卡片可显示“添加到 Aria2”补救动作。
result: pass

### 4. 同源重试行为
expected: 出现错误后点击“重试”，播放器只重试当前源，不自动切换下一个 player；若能够恢复，应从尽可能接近上次位置继续；若短时间内再次失败，应显示“多次失败，请返回详情页切换源”或等价文案。
result: pass

### 5. R18 detail 防御未回退
expected: 对未验证 R18 的账号，直接访问一部 R18 影片详情或播放页仍返回 403 / 无法进入；已验证账号保持原有可见性，不因为 Phase 3 的播放层改动额外被拦。
result: [passed] 2026-05-12 — 访问 `http://localhost:8080/movie/movie/REBD-1024` 时浏览器页面进入“加载影片详情失败”；本地 API `GET /api/public/movies/REBD-1024` 返回 `需要 R18 访问权限`。本轮安全修复后，未认证用户即使直接打开 `/movie/REBD-1024/play?streamUrl=...` 也会先被详情授权拦下，不再继续初始化播放器。

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
