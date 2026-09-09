## Why
电影运管的有/无播放源筛选依赖历史汇总字段 `totalPlayers`，该字段与实际 players 行可能不一致。
## What Changes
- `hasPlayers` SHALL 使用 players 表实时存在性查询。
## Capabilities
### New Capabilities
- `movie-player-filter-integrity`: 运管播放源筛选准确性。
### Modified Capabilities
## Impact
影响电影管理列表筛选，不改变播放源数据。
