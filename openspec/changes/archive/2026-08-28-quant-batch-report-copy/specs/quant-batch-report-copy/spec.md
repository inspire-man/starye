# quant-batch-report-copy Specification

## ADDED Requirements

### Requirement: Copy completed batch research reports

Quant 对比抽屉 MUST 在当前批量研究已结束且至少有一份成功研究报告时提供复制 Markdown 操作。复制内容 MUST 使用现有 `buildResearchBatchMarkdown` formatter，保留成功报告的选择顺序和失败项目摘要；操作 MUST NOT 发起网络请求或修改候选、对比、研究运行和排序状态。

#### Scenario: Copy a partially successful batch

- **WHEN** 当前批次已完成，至少一份报告成功且至少一份报告失败
- **THEN** 页面显示可执行的批量复制操作
- **AND** 剪贴板内容包含成功报告和失败股票摘要
- **AND** 成功报告顺序与批量下载 formatter 一致

#### Scenario: Copy a fully successful batch

- **WHEN** 当前批次的所有报告都成功完成
- **THEN** 页面显示可执行的批量复制操作
- **AND** 剪贴板只包含当前批次成功报告
- **AND** 操作不重新请求或重新生成任何报告

#### Scenario: Batch is empty or still running

- **WHEN** 当前批次没有成功报告，或仍有任务排队/运行
- **THEN** 页面不执行剪贴板写入
- **AND** 复制操作保持隐藏或禁用

### Requirement: Report batch clipboard outcome honestly

批量复制 MUST 在剪贴板写入成功后显示成功状态；浏览器不支持剪贴板、用户拒绝权限或写入过程抛错时 MUST 显示失败状态，且 MUST NOT 显示成功状态。写入进行中 MUST 防止同一操作重复提交，失败后 MUST 保留可重试能力。

#### Scenario: Clipboard write succeeds

- **WHEN** 浏览器接受当前批量 Markdown 写入
- **THEN** 页面显示已复制的成功提示
- **AND** 当前批量状态、候选选择和对比数据保持不变

#### Scenario: Clipboard write fails

- **WHEN** 浏览器没有可用的 `navigator.clipboard.writeText`，或写入 Promise 失败
- **THEN** 页面显示可理解的失败提示
- **AND** 页面不显示成功状态
- **AND** 用户可以再次执行批量复制

### Requirement: Copy control remains accessible on narrow screens

批量复制操作 MUST 使用现有 Quant 按钮的可见焦点和 accessible name；在 390px 视口中批量研究操作区 MUST 可以换行，文本 MUST 不溢出或遮挡结果列表。

#### Scenario: Focus the batch copy action

- **WHEN** 用户通过键盘聚焦批量复制操作
- **THEN** 操作具有描述批量 Markdown 复制用途的 accessible name
- **AND** 页面显示可见焦点状态

#### Scenario: Render batch actions on a narrow viewport

- **WHEN** 对比抽屉在 390px 视口显示已完成批量研究
- **THEN** 生成、复制和下载操作可以纵向排列
- **AND** 操作区不产生横向滚动
