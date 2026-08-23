## ADDED Requirements

### Requirement: 观察池估值比较接口

系统 MUST 提供受 Quant 管理员认证保护的 `GET /api/quant/valuation/compare/:tsCode` 接口，只使用当前观察池的估值快照计算目标股票的相对位置。

#### Scenario: 完整观察池样本

- **WHEN** 已认证用户请求观察池中的股票，且目标和至少两个其他观察池股票都有 TTM PE、PB
- **THEN** API 返回目标估值、观察池样本数、可用样本数，以及目标 TTM PE/PB 高于多少比例观察池股票

#### Scenario: 目标不在观察池

- **WHEN** 已认证用户请求不属于当前观察池的合法股票代码
- **THEN** API 返回结构化 404 Quant 错误，不为该股票拼接比较样本

#### Scenario: 指标缺失

- **WHEN** 目标或观察池股票缺少 TTM PE 或 PB
- **THEN** 对应相对位置返回 null，其他指标和可用样本统计保持可读

#### Scenario: 部分上游失败

- **WHEN** 观察池中部分股票的估值请求失败
- **THEN** API 保留成功读取的样本并返回实际可用样本数，不把失败股票当成 0 或有效排名

### Requirement: 工作台相对位置提示

择股工作台 MUST 在估值速览中显示观察池相对位置、比较样本数和比较范围；相对位置不足时 MUST 显示诚实的暂无样本状态。

#### Scenario: 展示相对位置

- **WHEN** 比较接口返回有效 TTM PE/PB 相对位置
- **THEN** 页面显示“高于观察池 X%”和样本数量，并标注“仅当前观察池”

#### Scenario: 样本不足

- **WHEN** 可比较的其他观察池样本少于两个或目标指标为空
- **THEN** 页面显示“暂无足够样本”，不展示推测百分比

#### Scenario: 移动端布局

- **WHEN** 页面宽度为 390px
- **THEN** 相对位置内容堆叠显示，页面不产生横向溢出
