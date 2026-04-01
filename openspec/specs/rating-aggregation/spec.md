# Spec: 评分数据聚合

## ADDED Requirements

### Requirement: 评分数据实时聚合

系统 MUST 实时计算和更新播放源的聚合评分数据。

#### Scenario: 计算平均评分
- **WHEN** 新的用户评分提交
- **THEN** 系统重新计算播放源的平均评分：sum(scores) / count(scores)

#### Scenario: 更新评分人数
- **WHEN** 新的用户评分提交
- **THEN** 系统增加播放源的评分人数计数器

#### Scenario: 处理评分修改
- **WHEN** 用户修改已有评分
- **THEN** 系统重新计算平均分，但评分人数不变

### Requirement: 评分缓存策略

系统 SHALL 使用缓存优化评分查询性能 MUST。

#### Scenario: 缓存聚合数据
- **WHEN** 系统计算播放源的聚合评分
- **THEN** 系统将结果缓存到 `player` 表的 `averageRating` 和 `ratingCount` 字段

#### Scenario: 缓存失效
- **WHEN** 新评分提交或评分修改
- **THEN** 系统立即更新缓存数据

#### Scenario: 批量查询优化
- **WHEN** 查询多个播放源的评分
- **THEN** 系统直接从 `player` 表读取缓存数据，无需实时计算

### Requirement: 评分分布统计

系统 MUST 提供评分的分布统计数据。

#### Scenario: 计算各星级数量
- **WHEN** 查询播放源评分详情
- **THEN** 系统返回每个星级（1-5星）的评分数量

#### Scenario: 计算评分中位数
- **WHEN** 评分数量足够（≥10个）
- **THEN** 系统计算并返回评分中位数，减少极端值影响

### Requirement: 全局评分统计

系统 SHALL 提供全站的评分统计信息 MUST。

#### Scenario: 热门评分播放源
- **WHEN** 用户查看推荐或热门页面
- **THEN** 系统返回评分最高且评价人数 ≥ 10 的播放源列表

#### Scenario: 最新评分动态
- **WHEN** 用户查看评分动态
- **THEN** 系统返回最近 24 小时的评分活动（影片、分数、时间）

#### Scenario: 用户评分历史
- **WHEN** 用户查看个人评分记录
- **THEN** 系统返回该用户所有评分历史，按时间倒序

### Requirement: 评分数据一致性

系统 MUST 确保评分数据在并发场景下的一致性。

#### Scenario: 并发评分处理
- **WHEN** 多个用户同时评分同一播放源
- **THEN** 系统使用事务或乐观锁确保评分计数正确

#### Scenario: 评分删除时重新聚合
- **WHEN** 管理员删除异常评分
- **THEN** 系统重新计算平均分和评分人数
