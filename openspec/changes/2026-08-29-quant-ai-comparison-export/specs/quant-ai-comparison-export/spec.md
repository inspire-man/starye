# AI 对比研究导出与复制

## ADDED Requirements

### Requirement: Successful comparison results can be exported

当 AI 对比研究已有成功结果时，Quant MUST 提供本地 Markdown 导出操作。导出内容 MUST 使用当前解析的 `QuantResearchComparison`，并包含版本、provider、模型、生成时间、概览、共同点、关键差异、风险、下一步核对和证据引用；MUST 使用字段白名单。

#### Scenario: Export a successful comparison

- **WHEN** 当前 AI 对比研究结果成功生成且不在加载态
- **THEN** 对比结果显示可访问的 Markdown 导出操作
- **AND** 浏览器下载的文件包含当前结果的固定字段和原始顺序
- **AND** 导出不发起 API 请求、不修改研究报告或候选状态

#### Scenario: Comparison result is unavailable

- **WHEN** AI 对比尚未生成、正在加载或生成失败
- **THEN** 页面不显示可执行的对比结果导出操作
- **AND** 既有生成、重试和错误状态保持可用

### Requirement: Successful comparison results can be copied

当 AI 对比研究已有成功结果时，Quant MUST 提供本地 Markdown 复制操作。复制 MUST 使用与导出相同的 formatter，并 MUST 区分复制中、成功、剪贴板不可用和写入失败状态。

#### Scenario: Clipboard write succeeds

- **WHEN** 用户点击成功态对比结果的复制操作且浏览器剪贴板可用
- **THEN** 完整 Markdown 被写入剪贴板
- **AND** 页面显示已复制状态

#### Scenario: Clipboard is unavailable or rejects

- **WHEN** 浏览器不支持剪贴板或写入 Promise 失败
- **THEN** 页面显示对应的不可用或失败反馈
- **AND** 当前对比结果保持可读并允许用户重试

### Requirement: Transfer state remains isolated from comparison state

导出/复制反馈 MUST 与确定性研究数据和 AI 生成状态分离。对比结果改变、候选范围改变、抽屉关闭或新一轮生成开始时，旧的异步复制结果 MUST NOT 覆盖当前对比结果的反馈。

#### Scenario: Comparison changes while copying

- **GIVEN** 对比结果 A 正在复制
- **WHEN** 当前对比结果被替换或清空
- **THEN** A 的复制结果被忽略
- **AND** 新结果的导出/复制状态从干净状态开始

### Requirement: Comparison transfer actions remain responsive

导出和复制操作 MUST 在窄屏下保持可访问和可读。按钮、状态反馈和长对比文本 MUST 在各自区域内换行，不得横向溢出或遮挡引用证据操作。

#### Scenario: Comparison result is shown at 390px

- **WHEN** 用户在 390px 视口查看成功的 AI 对比结果
- **THEN** 导出和复制按钮可以切换到单列并保持可键盘访问
- **AND** 页面没有横向溢出
