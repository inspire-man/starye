# quant-data-health-actions Specification

## ADDED Requirements

### Requirement: Expose an honest data-health next action

Quant 数据健康摘要 MUST 为非完整且不处于读取中的数据域提供固定的复核入口。日线数据域 MUST 指向观察池，价值质量和股东回报 MUST 指向候选研究；完整或读取中的数据域 MUST 不显示下钻动作。

#### Scenario: Daily coverage is incomplete

- **WHEN** 日线同步状态为部分可用、待补数据或读取失败
- **THEN** 数据健康项显示进入观察池的动作
- **AND** 动作不会直接发起同步或写入数据

#### Scenario: Research data is incomplete

- **WHEN** 价值质量或股东回报状态为部分可用、待补数据或读取失败
- **THEN** 对应数据健康项显示进入候选研究的动作
- **AND** 动作保留当前缺口文案与观测时间

#### Scenario: Data is ready or loading

- **WHEN** 数据域状态为完整或读取中
- **THEN** 对应数据健康项不显示下钻动作

### Requirement: Navigate through the existing Quant views

下钻操作 MUST 复用现有 Quant 视图导航和 hash 规范，只改变当前视图位置；操作 MUST NOT 发起额外 API 请求、修改 D1、触发同步、生成研究报告或改变候选排序。

#### Scenario: Follow a data-health action

- **WHEN** 用户点击数据健康项的下钻按钮
- **THEN** 页面进入该数据域对应的现有 Quant 视图
- **AND** 已加载的观察池、候选和数据健康状态保持不变

### Requirement: Keep actions accessible and responsive

下钻按钮 MUST 具有可见文本、描述用途的 accessible name 和可见焦点；在 390px 视口中按钮文字 MUST 换行或收缩而不溢出、遮挡或产生横向滚动。

#### Scenario: Use the action with keyboard focus

- **WHEN** 用户通过键盘聚焦数据健康下钻按钮
- **THEN** 页面显示现有 Quant 的可见焦点状态
- **AND** accessible name 明确目标数据域与目标视图
