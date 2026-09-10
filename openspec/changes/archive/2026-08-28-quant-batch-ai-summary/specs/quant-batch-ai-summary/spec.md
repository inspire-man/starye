# quant-batch-ai-summary Specification

## ADDED Requirements

### Requirement: Generate summaries for completed batch reports

Quant 工作台 MUST 在当前对比批次的研究状态全部结束且至少存在一份成功研究报告时显示批量 AI 摘要操作。只有用户主动点击后，页面才可针对成功研究运行调用现有摘要 API；操作 MUST 最多处理 3 项且并发不超过 2。错误研究项、没有 `runId` 的项和未完成批次 MUST 不发起摘要请求。

#### Scenario: Start a completed batch

- **WHEN** 当前批次已完成并有两份成功研究运行，用户点击批量 AI 摘要
- **THEN** 两个运行按稳定顺序进入 pending/running 状态
- **AND** 每个运行只调用一次其对应的摘要 API
- **AND** 页面不修改研究报告、候选评分、研究标记或选择集

#### Scenario: Do not start before the batch is ready

- **WHEN** 批次仍在读取历史、生成研究或没有成功运行
- **THEN** 页面不显示可执行的批量 AI 摘要操作
- **AND** 不调用摘要 API

### Requirement: Preserve per-item outcomes and retry failures

批量 AI 摘要 MUST 对每个成功研究运行分别显示 pending、running、success 或 error。某项失败时 MUST 继续处理其他项；批量完成后，失败项 MUST 可以单独重试，重试 MUST 只调用该项当前研究运行的摘要 API并保留其他项的成功摘要。

#### Scenario: One summary fails

- **WHEN** 三个研究运行中一个摘要请求失败
- **THEN** 另外两个运行继续完成
- **AND** 失败项显示失败状态和可理解的错误信息
- **AND** 用户点击重试时只重置并重新执行失败项

#### Scenario: Prevent duplicate and stale updates

- **WHEN** 批量摘要正在执行，用户再次点击批量按钮或单项重试
- **THEN** 重复操作不会新增摘要请求
- **AND** 新一轮研究报告开始后，旧摘要请求的回调不会覆盖新状态

### Requirement: Keep AI and report boundaries explicit

批量 AI 摘要 MUST 使用当前页面已加载的成功研究运行 ID，不把 API key 或完整配置发送到浏览器。摘要状态、provider 和 model 只作为当前批次的辅助状态展示；批量报告 Markdown 导出和复制 MUST 保持原有确定性报告白名单与行为。

#### Scenario: Existing configuration is unavailable

- **WHEN** 用户已主动启动批量摘要但 AI 配置缺失或 endpoint 失败
- **THEN** 受影响项显示失败状态和服务端分类错误
- **AND** 其他项继续按各自结果完成
- **AND** 页面不显示成功摘要或泄露配置内容

### Requirement: Remain accessible on narrow screens

摘要按钮、每项状态和失败重试操作 MUST 具有可访问名称、可见焦点和稳定布局；在 390px 视口中操作区和错误文案 MUST 换行且不横向溢出或遮挡研究数据。

#### Scenario: Use the retry action with keyboard focus

- **WHEN** 用户通过键盘聚焦失败项的摘要重试操作
- **THEN** 操作显示可见焦点并明确描述目标股票和摘要用途
