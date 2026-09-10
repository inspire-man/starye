## Why
电影运管已有 admin API 和 crawler 能力，但缺封面、预览图、播放源重检、元数据同步和关系修复仍是分散脚本，缺少统一任务批次和 D1 readback。

## What Changes
- 上述运管任务共享任务批次、状态、失败原因、重试和 D1 readback。
- 管理端可观察最近批次和失败原因，而不是继续增加一次性脚本。

## Non-goals
不把 Quant 或漫画任务并入电影运管。

## Impact
涉及 crawler task 控制面、Dashboard 和电影回填/修复入口。
