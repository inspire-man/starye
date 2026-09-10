## ADDED Requirements
### Requirement: Filter by persisted player rows
电影管理 `hasPlayers` 筛选 SHALL 以 players 表是否存在关联行作为唯一判断。
#### Scenario: Has players
- **WHEN** 至少存在一条 players.movie_id 关联行
- **THEN** `hasPlayers=true` 条件匹配
#### Scenario: No players
- **WHEN** 不存在关联行
- **THEN** `hasPlayers=false` 条件匹配
