## Purpose

让用户可以把单股 AI 摘要中的下一步核对项直接带入当前研究报告问答框，在保留报告范围和人工确认边界的同时减少重复输入。

## ADDED Requirements

### Requirement: Summary next checks expose a reuse action

成功的单股 AI 摘要 MUST 为每个下一步核对项提供可访问的“带入追问”操作。操作 MUST 与核对文本同级，不得嵌套在其他按钮内，并 MUST 保留当前报告语义。

#### Scenario: Summary has next checks

- **WHEN** 单股 AI 摘要成功且返回下一步核对项
- **THEN** 每个核对项同时显示文本和同级快捷按钮
- **AND** 快捷按钮具有可见文本、图标、`aria-label` 和 `title`

### Requirement: Reuse fills and focuses without submitting

快捷复用 MUST 将核对项转换成当前报告范围的问题，填入研究问答框并聚焦 textarea。快捷复用 MUST NOT 自动提交问题、发起网络请求或改变已保存研究报告。

#### Scenario: User reuses a summary check

- **WHEN** 用户点击单股摘要的“带入追问”按钮
- **THEN** 当前研究问答框填入生成的问题并获得焦点
- **AND** `ask` 事件和研究问答 API 在用户主动提交前不发生

### Requirement: Reuse prompt is bounded and honest

快捷问题 MUST 不超过 500 个字符；空核对项 MUST 不产生输入更新。长核对项 MUST 截断核对文本并保留固定问题后缀，不得加入摘要之外的事实、买入卖出建议或收益判断。

#### Scenario: Check text is blank or long

- **WHEN** 核对项为空或超过输入长度
- **THEN** 空值快捷操作不更新问题输入，长值生成的完整问题长度不超过 500 字符且仍以固定后缀结尾

### Requirement: Reuse respects question availability

快捷按钮 MUST 在研究问答组件不可用或正在加载时 disabled；disabled 状态下 MUST 不更新问题输入、不触发焦点，也不触发其他摘要动作。

#### Scenario: Question flow is unavailable

- **WHEN** 研究问答正在加载或当前页面暂时没有可用问答组件
- **THEN** 所有摘要核对项快捷按钮处于 disabled
- **AND** 摘要内容和现有生成/配置操作保持可用

### Requirement: Narrow summary remains usable

快捷按钮 MUST 在 390px 视口下换行到独立区域，核对文本和按钮不得横向溢出、重叠或遮挡，并 MUST 保持键盘可访问。

#### Scenario: Summary is viewed on a narrow screen

- **WHEN** 用户在 390px 宽度查看有下一步核对项的摘要
- **THEN** 核对文本和快捷按钮均在摘要范围内可见并可通过键盘操作
