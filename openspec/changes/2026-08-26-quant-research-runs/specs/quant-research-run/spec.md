# quant-research-run Specification

## ADDED Requirements

### Requirement: Structured research report

已登录用户请求观察池中的股票时，系统 MUST 生成一个带唯一 `runId` 的 `research-report-v1` 报告。报告 MUST 包含状态、研究动作、分数、优势、风险、缺口、下一步动作和 `evidence[]`。

#### Scenario: 报告生成成功

- **WHEN** 当前用户请求 `POST /api/quant/research/runs` 且 `ts_code` 属于自己的观察池
- **THEN** 返回 2xx、当前用户的 `run` 和至少一条带完整元数据的证据

#### Scenario: 股票不属于当前观察池

- **WHEN** 请求的代码不属于当前用户观察池
- **THEN** 返回 404，且不创建研究运行

### Requirement: Auditable evidence chain

每条 `evidence[]` MUST 包含状态、来源、观察时间、阈值、原始数值或明确的缺失值、公式版本和解释详情。系统 MUST 区分 `pass`、`caution`、`fail`、`missing`，不得把 provider 错误或没有样本转换为通过。

#### Scenario: 上游数据缺失

- **WHEN** 估值、财务或分红 provider 返回错误或无数据
- **THEN** 对应证据标记为 `missing` 或 `partial`，报告保留可用的其他证据，并在 `gaps` 和 `nextActions` 中说明缺口

### Requirement: User-scoped research history

研究运行 MUST 按 Better Auth `user.id` 持久化。`GET /api/quant/research/runs/:tsCode` MUST 只返回当前用户的运行，并按生成时间倒序限制数量。

#### Scenario: 用户隔离

- **WHEN** 用户 A 生成报告后用户 B 查询相同股票
- **THEN** 用户 B 看不到用户 A 的运行，除非 B 自己也将该股票加入观察池并生成报告

### Requirement: Workbench consumption

分析详情抽屉 MUST 提供生成研究报告入口，并展示最新报告的动作、分数和证据摘要。报告生成中、失败、无历史和窄屏状态 MUST 有稳定且不重叠的布局。

#### Scenario: 抽屉显示报告状态

- **WHEN** 用户打开观察池股票的分析抽屉
- **THEN** 抽屉显示研究历史空状态、加载状态或最新报告，并提供生成/重新生成入口

### Requirement: Deterministic runtime boundary

本 change MUST 保持报告计算确定性；LLM、AkShare Python bridge 和买卖指令属于后续 change。未来 bridge 输出 MUST 映射到版本化 provider 输入，不得让 Worker 直接依赖 Python 运行时。

#### Scenario: 后续 bridge 接入

- **WHEN** 后续系统接入 AkShare bridge 或 AI agent
- **THEN** bridge 只提供版本化标准化输入，Worker 保留原始证据和确定性状态，不让模型覆盖原始数值或证据状态
