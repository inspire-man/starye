# quant-data-freshness Specification

## ADDED Requirements

### Requirement: Expose freshness separately from completeness

Quant 数据健康模型 MUST 为摘要和每个数据域提供独立的新鲜度状态。新鲜度 MUST 只根据可验证观察时间计算，不得覆盖或修改完整性状态。

#### Scenario: Recent observation

- **WHEN** 数据域观察时间距离当前时间不超过 48 小时
- **THEN** 新鲜度为“最新”
- **AND** 完整性状态保持原有计算结果

#### Scenario: Observation needs review

- **WHEN** 数据域观察时间距离当前时间超过 48 小时且不超过 7 天
- **THEN** 新鲜度为“需复核”
- **AND** 页面提示刷新数据但不改变信号或推荐

#### Scenario: Observation is stale

- **WHEN** 数据域观察时间距离当前时间超过 7 天
- **THEN** 新鲜度为“已过期”
- **AND** 完整但过期的数据仍保留完整性状态

#### Scenario: Observation time is unverifiable

- **WHEN** 观察时间缺失、格式无效或晚于当前时间
- **THEN** 新鲜度为“时间未知”
- **AND** 系统不推断为最新或已过期

### Requirement: Aggregate freshness honestly

数据健康摘要 MUST 汇总各数据域的新鲜度。任一数据域已过期时摘要 MUST 为已过期；否则任一数据域需复核时摘要 MUST 为需复核；只有全部数据域均有可验证观察时间且为最新时摘要才为最新；其余情况 MUST 为时间未知。

#### Scenario: Complete but stale research data

- **WHEN** 完整性摘要为完整但至少一个数据域已过期
- **THEN** 摘要同时显示“数据完整”和“已过期”两个状态
- **AND** 摘要说明先刷新后再进行当前判断

#### Scenario: Incomplete but fresh data

- **WHEN** 至少一个数据域字段不完整但所有数据域观察时间均为最新
- **THEN** 摘要显示部分可用与最新
- **AND** 不把新鲜度当作字段完整性

### Requirement: Preserve freshness for retained results

当读取失败或正在刷新且系统保留最近一次有效结果时，数据域 MUST 继续使用该结果的观察时间计算新鲜度；首次读取没有有效结果时 MUST 显示时间未知。

#### Scenario: Refresh fails after a valid result

- **WHEN** 数据域已有有效结果，后续读取失败
- **THEN** 旧结果和其新鲜度仍可见
- **AND** 页面同时显示读取失败与重试入口

#### Scenario: Refresh is in progress after a valid result

- **WHEN** 数据域已有有效结果，后续读取正在进行
- **THEN** 页面显示刷新中和旧结果的新鲜度
- **AND** 旧结果不会被清空或标记为本次刷新成功

### Requirement: Keep freshness informational and responsive

新鲜度展示 MUST 只提供数据复核信息，不得触发 API、写入 D1 或改变因子分数、权重、AI 判断和交易建议。新鲜度标签和说明在 390px 视口 MUST 换行且不产生横向滚动。

#### Scenario: Review freshness on a narrow viewport

- **WHEN** 用户在 390px 视口查看数据健康
- **THEN** 完整性和新鲜度状态均可读
- **AND** 长观察时间/提示文字不遮挡其他数据或产生横向滚动
