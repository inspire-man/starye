# quant-data Specification

## Purpose
定义量化工作台的 D1 表、约束和权威读回要求。

## Requirements

### Requirement: 独立量化表

系统 MUST 使用独立的 `quant_watchlist`、`quant_daily_bar`、`quant_scan_snapshot` 和 `quant_sync_state` 表。估值、股票基础信息和交易日历字段 MUST 不写入 `quant_daily_bar`。

#### Scenario: Migration 建表

- **WHEN** 应用执行量化 migration
- **THEN** 四张 v1 表及必要唯一索引存在
- **AND** migration 不修改现有内容表字段

### Requirement: 日线幂等

`quant_daily_bar` MUST 以 `ts_code + trade_date` 唯一约束日线。重复 provider 响应 MUST 使用 upsert 或等价幂等写入，不能产生重复行。

#### Scenario: 重复同步

- **WHEN** 同一观察项和日期范围执行两次同步
- **THEN** D1 中每个 `ts_code + trade_date` 只有一行
- **AND** `quant_sync_state` 的最后状态与最新同步一致

### Requirement: 快照可追溯

`quant_scan_snapshot` MUST 保存观察池、因子版本、生成时间、候选结果和输入范围。候选查询 MUST 从已保存快照或其明确的 D1 投影读取，不把未持久化的内存结果作为完成证据。

#### Scenario: 候选快照读回

- **WHEN** 同步和筛选完成
- **THEN** 通过 API 查询到快照
- **AND** 直接 D1 查询能读回同一快照标识和候选内容

### Requirement: 边界与日线窗口

观察池 MUST 限制为最多 50 条；单次同步 MUST 限制为最多 50 个股票和每只股票最多 120 根 provider 返回日线。120 积分默认使用最近 180 个自然日作为请求窗口，未启用 `trade_cal` 时不把自然日窗口表述为精确交易日数，也不写入虚构日期。日期、代码、数值字段 MUST 经过服务端规范化，provider 的未知字段 MUST 丢弃。

#### Scenario: 越界请求

- **WHEN** 请求超过观察池、股票数或日期窗口限制
- **THEN** API 返回 `400` 或 `409`，并且 D1 不发生超限写入

### Requirement: 全局同步状态与快照保留

`quant_sync_state` MUST 以 `id='daily'` 保存全局同步状态，并支持 `run_id`、租约过期时间或等价的 owner/CAS 元数据。启动同步 MUST 通过原子条件取得租约；有效租约存在时，后续请求返回 `409 QUANT_SYNC_IN_PROGRESS`，不能覆盖当前 `running` 状态。完成、部分完成、拒绝和租约接管的写入 MUST 校验 owner `run_id`，旧 run 的迟到结果不能覆盖新 run 的状态或快照。

`quant_scan_snapshot` MUST 只保存 `completed` 或 `partial` 的有效结果，拒绝同步只在 `quant_sync_state` 留痕。系统 MUST 保留最近 30 个有效快照，并在新快照已完成权威写入后删除更旧快照；最新可查询快照不能因为清理而消失。日线行的生命周期与快照分开，重复同步只 upsert 日线，不因快照清理删除日线。

#### Scenario: 并发同步的状态保护

- **WHEN** 两个请求同时尝试创建 `daily` 同步
- **THEN** 只有一个请求取得租约并进入 provider 阶段，另一个请求得到 `409 QUANT_SYNC_IN_PROGRESS`
- **AND** D1 最终状态只能由持有对应 `run_id` 的 owner 收口

#### Scenario: 有效快照清理

- **WHEN** 第 31 个 `completed`/`partial` 快照在新结果已持久化后生成
- **THEN** D1 保留最新 30 个快照，最新快照的 id、候选内容和同步状态仍可读回
- **AND** `quant_daily_bar` 的幂等日线行不因快照清理而减少

### Requirement: Independent research marker storage

Quant research markers MUST be stored in an independent `quant_research_marker` table with a unique `ts_code`, status, nullable note, nullable review date, and update timestamps. The table MUST NOT change the existing daily bar or candidate snapshot records.

#### Scenario: Migration creates marker storage

- **WHEN** migration `0039_quant_research_marker.sql` is applied
- **THEN** the marker table and its status/code indexes exist
- **AND** one `ts_code` cannot have two marker rows

#### Scenario: Repeated upsert

- **WHEN** the same stock marker is saved repeatedly
- **THEN** one row remains for that code with the latest status, note, review date, and updated timestamp
