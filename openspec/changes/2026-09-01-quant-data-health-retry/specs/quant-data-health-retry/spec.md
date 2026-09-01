# quant-data-health-retry Specification

## ADDED Requirements

### Requirement: Execute the correct data-health next action

Quant 数据健康摘要 MUST 为非完整且不处于读取中的数据域提供与数据域匹配的可执行动作。日线 MUST 进入观察池；价值质量 MUST 触发价值质量读取；股东回报 MUST 触发股东回报读取。完整或读取中的数据域 MUST 不显示动作。

#### Scenario: Daily data needs attention

- **WHEN** 日线状态为部分可用、待补数据或读取失败
- **THEN** 用户点击下一步后进入观察池
- **AND** 本次点击不额外触发数据请求

#### Scenario: Value quality needs refresh

- **WHEN** 价值质量状态为部分可用、待补数据或读取失败
- **THEN** 用户点击下一步后触发一次价值质量读取
- **AND** 页面保留在当前视图并更新该数据域状态

#### Scenario: Shareholder returns needs refresh

- **WHEN** 股东回报状态为部分可用、待补数据或读取失败
- **THEN** 用户点击下一步后触发一次股东回报读取
- **AND** 页面保留在当前视图并更新该数据域状态

#### Scenario: Data is ready or loading

- **WHEN** 数据域状态为完整或读取中
- **THEN** 对应数据健康项不显示下一步动作

### Requirement: Preserve the last valid research result on refresh failure

价值质量或股东回报已经存在最近一次成功结果时，新的读取 MUST 失败时，系统 MUST 保留该结果，不得用空值覆盖；同时 MUST 暴露本次失败状态和重试入口。旧结果 MUST 继续标识为最近一次成功结果，而不是被标记为本次刷新成功。

#### Scenario: Value quality refresh fails after a successful read

- **WHEN** 价值质量已有成功结果且后续读取失败
- **THEN** 价值质量详情仍显示上一次结果
- **AND** 页面显示刷新失败状态和重试动作

#### Scenario: Shareholder returns refresh fails after a successful read

- **WHEN** 股东回报已有成功结果且后续读取失败
- **THEN** 股东回报详情仍显示上一次结果
- **AND** 页面显示刷新失败状态和重试动作

#### Scenario: A stale response arrives

- **WHEN** 较早请求在较新请求之后返回
- **THEN** 较早响应不得覆盖当前结果、loading 或错误状态

### Requirement: Preserve the last valid sync state while reporting hydration failure

同步状态已经存在最近一次有效结果时，后续状态读取失败 MUST 保留该结果，并 MUST 显示读取失败提示和可重试入口。读取重试期间 MUST 不清空最近一次有效结果。

#### Scenario: Sync state hydration fails

- **WHEN** 页面已有最近一次同步结果且同步状态读取失败
- **THEN** 同步面板继续显示该结果的时间、状态和计数
- **AND** 面板同时显示状态读取失败信息与重试入口

#### Scenario: Sync state is unavailable initially

- **WHEN** 页面尚无同步结果且同步状态读取失败
- **THEN** 页面显示失败状态和重试入口
- **AND** 不创建虚假的同步结果或计数

### Requirement: Keep refresh feedback honest and responsive

刷新中的旧结果、刷新失败的旧结果和首次读取失败 MUST 使用可区分的状态反馈；按钮 accessible name MUST 包含数据域和动作语义。页面在 390px 视口 MUST 不产生横向滚动或文字遮挡。

#### Scenario: Retry from the data-health summary

- **WHEN** 用户在总览点击价值质量或股东回报的下一步
- **THEN** 对应按钮显示读取状态并在完成后显示成功结果或失败重试状态
- **AND** 其他数据域的已有结果保持不变
