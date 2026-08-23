# quant-financial-trend Specification

## Purpose

让择股工作台能把最近披露的财务质量放进时间和观察池两个维度中阅读。

## ADDED Requirements

### Requirement: Recent financial history

Quant API MUST 提供受现有认证保护的 `GET /api/quant/financial/history/:tsCode`，返回目标股票最近最多 8 期、默认 4 期的财务质量报告；报告 MUST 按报告期从新到旧排列，空数值 MUST 保持为 `null`。

#### Scenario: Return recent reports

- **WHEN** 已认证用户请求观察池中的合法 A 股且 Eastmoney 返回多期报告
- **THEN** 接口返回目标 `tsCode`、观察时间和按报告期倒序排列的报告数组，默认最多 4 条

#### Scenario: Limit history length

- **WHEN** 请求带有 `limit=6`
- **THEN** 接口最多返回 6 条报告，且不会超过服务端允许的 8 条上限

#### Scenario: Preserve missing metrics

- **WHEN** 某期报告的财务字段为空、`-` 或 `--`
- **THEN** 该字段返回 `null`，不影响同一报告其他合法字段

### Requirement: Financial quality peer comparison

Quant API MUST 提供受现有认证保护的 `GET /api/quant/financial/compare/:tsCode`，只使用当前观察池的最新财务报告计算相对位置；目标或 peer 上游失败时 MUST 保留可用样本，不得把失败值当作 0。

#### Scenario: Compare available peers

- **WHEN** 目标和观察池其他股票至少有可用的营收同比、净利润同比、ROE 或资产负债率
- **THEN** 接口返回目标报告、peer 列表、样本统计，以及各指标的同池相对位置

#### Scenario: Target outside watchlist

- **WHEN** 请求股票不在当前观察池
- **THEN** 接口返回结构化 `QUANT_NOT_FOUND`，不拼接比较样本

#### Scenario: Insufficient samples

- **WHEN** 某指标没有至少两个可比较的 peer 值或目标值为空
- **THEN** 该指标相对位置返回 `null`，其他指标和样本数保持可读

### Requirement: Beginner-readable trend presentation

Quant 工作台 MUST 在基本面速览中展示最近报告的趋势与观察池质量位置；趋势提示 MUST 使用“改善、走弱、基本稳定或暂无足够数据”等解释性语言，并明确这些指标只用于观察，不代表未来收益。

#### Scenario: Show report trend

- **WHEN** 当前股票有至少两期合法财务报告
- **THEN** 页面展示报告期序列，并对营收同比、净利润同比、ROE 和资产负债率给出可读的变化方向

#### Scenario: Show peer quality position

- **WHEN** 同池比较返回有效位置
- **THEN** 页面展示目标相对观察池的质量位置和可用样本数，并标注“仅当前观察池”

#### Scenario: Isolate failure and stale responses

- **WHEN** 历史或比较接口失败，或用户快速切换股票导致旧请求晚于新请求完成
- **THEN** 只影响财务趋势区域，页面保留日线、估值和观察池数据，旧响应不得覆盖当前股票


