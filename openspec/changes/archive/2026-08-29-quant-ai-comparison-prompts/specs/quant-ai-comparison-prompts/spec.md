# AI 对比核对项快捷复用

## ADDED Requirements

### Requirement: Comparison next checks expose a reuse action

成功的 AI 对比结果 MUST 为每个下一步核对项提供一个可访问的“带入追问”操作。该操作 MUST 与核对文本同级，不得嵌套在其他按钮内，并 MUST 使用该核对项生成当前候选范围问题。

#### Scenario: Comparison result has next checks

- **WHEN** AI 对比结果成功且返回下一步核对项
- **THEN** 每个核对项显示文本和同级快捷按钮
- **AND** 快捷按钮具有可见文本、图标、`aria-label` 和 `title`

### Requirement: Reuse fills and focuses without submitting

快捷复用 MUST 通过候选 AI 简报现有输入桥接更新追问框并聚焦 textarea，MUST NOT 自动提交追问或发起网络请求。用户必须仍然主动点击提交按钮后才调用既有追问接口。

#### Scenario: User reuses a comparison check

- **WHEN** 用户点击对比结果的“带入追问”
- **THEN** 对比抽屉关闭，当前候选追问框填入该核对项生成的问题并获得焦点
- **AND** `askQuestion` 事件/API 在用户主动提交前不发生

### Requirement: Reuse prompt is bounded and honest

快捷问题 MUST 不超过 500 个字符；空核对项 MUST 不生成问题。问题必须保留当前候选范围语义，不得加入对比结果之外的事实或交易判断。

#### Scenario: Check text is empty or long

- **WHEN** 核对项为空或超过输入长度
- **THEN** 空值快捷操作不可产生输入更新，长值被截断到 500 字符以内且保留固定问题后缀

### Requirement: Reuse respects current question availability

快捷按钮 MUST 在当前快照不可用、当前筛选没有可追问候选或追问正在加载时 disabled；disabled 状态下不得关闭对比抽屉或更新问题输入。

#### Scenario: Current question flow is unavailable

- **WHEN** 当前候选追问不可用或正在加载
- **THEN** 所有对比核对项快捷按钮处于 disabled
- **AND** 对比结果和既有重试/引用操作保持可用

### Requirement: Narrow comparison drawer remains usable

快捷按钮 MUST 在 390px 视口下换行到独立区域，核对文本和按钮不得横向溢出、重叠或遮挡。

#### Scenario: Comparison drawer is narrow

- **WHEN** 用户在移动宽度查看成功的 AI 对比结果
- **THEN** 核对项和快捷按钮均可通过键盘访问
- **AND** 对比抽屉与页面没有横向溢出
