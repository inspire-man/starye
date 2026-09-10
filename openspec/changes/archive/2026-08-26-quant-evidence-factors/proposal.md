## Why

当前 AkShare bridge 已经把 ROE、营收同比、净利润同比、毛利率、净利率、资产负债率和日线标准化，但研究报告只展示样本数量。用户看不到同一条证据链中的具体数值、门槛、观测日期和来源，AI 摘要也缺少解释这些公开数据的基础。

## What Changes

- 将 bridge 已标准化的财务指标和有限日线窗口转换成逐项、可引用的证据；缺失字段保留为 `missing`，以真实数据状态呈现。
- 在确定性研究报告中保留这些可选 AkShare 证据，并对与现有 Eastmoney 最新财报相同口径的字段增加透明的跨来源核对结论。
- 让 AI 摘要提示明确区分报告原有结论和 AkShare 交叉证据，要求摘要引用 evidence key、说明数据日期和口径。
- 在 Quant 研究详情抽屉中按趋势、质量、风险展示 AkShare 因子，并显示数值、门槛、来源和观测日期；bridge 状态异常时继续显示确定性报告及数据缺口。

## Capabilities

### New Capabilities

- `quant-evidence-factors`: 为研究报告提供逐项 AkShare 因子、跨来源核对和可读证据展示。

### Modified Capabilities

- `quant-evidence-enrichment`: 扩展已有 bridge 证据，从样本计数延伸到可引用指标，保持确定性评分权威。
- `quant-ai-research-summary`: 扩展摘要输入说明和证据引用语义，摘要保留来源、日期和不确定性。

## Impact

- `apps/quant-akshare-bridge`：增加日线计算和财务字段证据生成，以及相应 Python 测试。
- `apps/api`：扩展研究报告证据映射、跨来源核对和 AI prompt 约束；不新增持久化表或交易接口。
- `apps/quant-app`：扩展研究详情抽屉的证据分组、格式化和状态展示。
- OpenSpec 与现有报告 v1/v2 读取兼容保持不变；所有新增 AkShare 因子均为可选证据，不改变旧报告的分数和动作。

## Goals / Non-Goals

**Goals:**

- 让每个新增因子都能回溯到 bridge endpoint、观测日期和公式版本。
- 为中长线价值研究提供便于初学者理解的“数值 + 门槛 + 解释”，并让 AI 只解释已有证据。
- 在数据不完整或不同来源不一致时明确展示缺口和核对状态。

**Non-Goals:**

- 不生成目标价、收益预测、自动交易或直接买卖指令。
- 不把 AkShare 因子直接计入现有确定性评分；评分公式的变更另立 change。
- 不引入更多 Python 运行时到 Worker，也不保存原始 DataFrame。

## Risks

- AkShare 字段含义或单位变化会导致因子失真；通过字段别名、数值边界、公式版本和来源日期降低风险。
- 不同 provider 报告期不同会造成表面差异；展示时同时给出报告期和“仅供交叉核对”语义，不强行合并数值。
- 日线窗口不足会误导趋势判断；窗口不足时返回 `caution` 或 `missing`，并保持报告动作不变。
