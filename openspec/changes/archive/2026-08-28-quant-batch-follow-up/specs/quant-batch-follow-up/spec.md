# quant-batch-follow-up Specification

## ADDED Requirements

### Requirement: Successful batch results open the authoritative detail

Quant 工作台 MUST 为批次中已成功生成研究运行的候选提供“查看详情”操作。用户执行该操作时，页面 MUST 关闭候选对比抽屉并通过既有股票详情加载流程重新读取该股票的研究历史、日线和相关数据。

#### Scenario: Open a successful result

- **WHEN** 某候选的批次状态为成功且包含研究运行
- **THEN** 批次行显示查看详情操作
- **AND** 操作打开该候选的详情抽屉并重新请求该候选的研究历史

#### Scenario: Successful result has no run payload

- **WHEN** 批次状态标记为成功但没有研究运行对象
- **THEN** 页面保留成功状态文本但不显示会产生错误导航的查看详情操作

### Requirement: Failed batch results support isolated retry

Quant 工作台 MUST 为批次中失败的候选提供单项重试操作。单项重试 MUST 只调用该候选的既有研究运行接口，并 MUST 保留其他候选的状态、结果和错误信息。

#### Scenario: Retry one failed result

- **WHEN** 某候选批次状态为失败且当前没有单项重试在执行
- **THEN** 页面显示单项重试操作并将该候选置为进行中
- **AND** 其他候选的批次状态不发生变化

#### Scenario: Retry succeeds

- **WHEN** 单项重试返回研究运行
- **THEN** 该候选显示接口返回的研究状态、研究动作和证据数量
- **AND** 页面显示查看详情操作

#### Scenario: Retry fails again

- **WHEN** 单项重试再次失败
- **THEN** 该候选回到失败状态并显示可理解的错误原因
- **AND** 用户可以再次重试该候选

### Requirement: Batch selection and history boundaries remain intact

批次后续操作 MUST 保留当前候选选择和对比数据；查看详情或单项重试 MUST NOT 修改候选信号、价值质量、研究优先级、研究标记或既有研究历史。

#### Scenario: Operate after a partial batch

- **WHEN** 一项成功、另一项失败的批次完成
- **THEN** 用户可以查看成功项或只重试失败项，且对比候选仍保持原选择
