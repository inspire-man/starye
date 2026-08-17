---
quick_id: 260817-expand-movie-crawl-range
title: 扩大生产电影爬取范围并完成真实播放验收
status: complete
branch: main
---

# 目标

在保留现有增量跳过、请求延迟、来源持久化和控制面绑定的前提下，将生产电影爬取范围从 50 部/5 页扩大到 100 部/10 页；用真实下载媒体完成浏览器播放验收，并删除临时验证数据。

## 任务

### 1. 扩大生产范围

- 修改 `packages/crawler/src/types/config.ts` 的生产推荐配置。
- 保持并发、延迟和增量模式不变，避免把扩容误变成请求速率扩张。
- 已完成：`maxMovies: 100`、`maxPages: 10`。

### 2. 验证与提交

- 运行爬虫配置相关测试、crawler type-check、diff 检查。
- 提交前运行 GitNexus `detect_changes`，确认只影响预期配置入口。
- 更新本 quick task 摘要和 `.planning/STATE.md`。
- 已完成：GitNexus detect-changes 为 LOW，无受影响执行流。

### 3. 真实播放验收与清理

- 通过 Gateway 详情页确认真实来源可用。
- 浏览器点击播放，记录 `canplay`、`playing`、`readyState`、`paused` 和 `currentTime` 增长。
- 删除临时验证影片，停止临时媒体服务，清理本次下载/GID 残留并读回确认。
- 已完成：真实播放证据采集完成；临时影片返回 404；临时服务、GID、下载文件和配置已清理。
