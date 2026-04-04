# movie-player-sync

## 描述

`POST /api/movies/sync` 端点及其底层服务 MUST 支持接收并持久化 `players` 数组，确保爬虫侧传入的播放源数据不被丢弃。

## Requirements

- REQ-1: `SyncMovieDataOptions.movies` 数组中每个影片项 MUST 支持可选的 `players` 字段
- REQ-2: 当 `players` 非空时，服务 MUST 先删除该影片现有 players，再插入新 players（幂等写入）
- REQ-3: 若 `players` 为空或未提供，现有 players 记录 SHALL 保持不变（不覆盖已有播放源）
- REQ-4: 写入失败 MUST 不影响影片元数据的正常写入（独立 try-catch）
- REQ-5: `players.sourceUrl` 字段 MUST 非空且唯一（单影片内去重）
