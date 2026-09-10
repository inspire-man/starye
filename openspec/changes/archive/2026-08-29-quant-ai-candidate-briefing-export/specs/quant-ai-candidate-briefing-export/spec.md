## ADDED Requirements

### Requirement: Candidate briefing Markdown export

当当前候选简报已成功生成时，Quant 候选页 MUST 提供 Markdown 导出操作。导出 MUST 使用当前页面已解析的简报数据生成本地文件；简报不存在时 MUST 不显示可执行的导出操作，也 MUST 不生成占位文件。

#### Scenario: Briefing is available

- **WHEN** 当前候选简报存在且页面处于成功态
- **THEN** 页面显示 Markdown 导出操作
- **AND** 用户触发后得到以生成日期命名的本地 Markdown 文件

#### Scenario: Briefing is unavailable

- **WHEN** 简报仍处于 idle、loading 或 error 状态
- **THEN** 页面不显示可执行的简报导出操作
- **AND** 页面不触发下载或伪造简报内容

### Requirement: Candidate briefing Markdown copy

当当前候选简报已成功生成时，Quant 候选页 MUST 提供复制 Markdown 操作。复制 MUST 将 formatter 生成的完整 Markdown 写入剪贴板，并 MUST 区分复制中、成功、剪贴板不可用和写入失败状态。

#### Scenario: Clipboard write succeeds

- **WHEN** 用户触发复制且浏览器剪贴板写入成功
- **THEN** 页面显示成功状态
- **AND** 剪贴板内容与当前简报 formatter 输出完全一致

#### Scenario: Clipboard write is unavailable or fails

- **WHEN** 浏览器没有剪贴板写入能力或写入被拒绝
- **THEN** 页面显示明确错误状态并保留可重试操作
- **AND** 页面不宣称复制成功

### Requirement: Preserve briefing facts and exclude configuration

导出的 Markdown 和复制内容 MUST 包含简报版本、provider、模型、生成时间、候选数量、概览、重点候选的代码/名称/优先级/分数/研究动作/原因/解释、下一步核对项和引用候选代码。内容 MUST 使用字段白名单，且 MUST 不包含 API key、token、cookie、内部配置或未知对象字段。

#### Scenario: Bounded allowlisted document

- **WHEN** 简报包含完整文本、空名称、空原因或附加未知属性
- **THEN** 输出保留明确的空值语义和允许字段
- **AND** 输出不序列化未知属性或敏感配置

### Requirement: Deterministic data remains unchanged

复制或导出操作 MUST NOT 发起网络请求，且 MUST NOT 修改候选快照、候选排序、优先级分数、研究动作或研究标记。候选数据刷新后，旧的复制状态 MUST 被清除。

#### Scenario: Candidate data refresh

- **WHEN** 当前候选快照被重新加载或更新
- **THEN** 简报复制状态被重置并等待新的简报
- **AND** 候选表与确定性研究字段保持原有值
