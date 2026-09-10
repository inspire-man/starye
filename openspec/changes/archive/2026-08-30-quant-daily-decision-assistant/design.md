## 设计概览

新增 `decision-assistant-v1` 领域模块，输入已持久化的 `QuantResearchReport`、服务端最新日线、服务端行情快照和用户场景数据。领域模块先计算确定性结果，再由 AI 复核器读取一份严格裁剪的事实包。AI 响应采用 JSON 对象并经过服务端字段、数值、因子和 evidence key 校验；最终合并只允许在报告覆盖度、证据、AI 引用和置信度达到门槛时使用 AI 动作。

## 场景和输出

- `buy`：服务端在提交评估时读取行情快照，返回当前价与参考买入区间的关系、确定性推荐和“分批考虑/等待/先核对”动作。
- `holding`：服务端读取当前价，用户输入成本价，可选输入持仓数量；返回浮亏百分比、回本所需涨幅、继续持有/减仓复核/等待/加仓复核等动作。
- 当前价来源标记为 `eastmoney-realtime` 或 `local-daily-bars`，并保存观察时间、涨跌幅和回退错误码；实时行情使用独立的 `EASTMONEY_QUOTE_BASE_URL`（默认 `https://push2.eastmoney.com`），历史日线继续使用 `EASTMONEY_BASE_URL`。历史旧快照继续保留 `user-input` 审计标记。最新日线、报告和证据保留其原始 `source`、`observedAt` 和公式版本。
- 可信度独立为 `high`、`medium`、`low`，由因子覆盖、证据可用度、来源状态、数据新鲜度和跨源核对提示组成，不等同于推荐分数。

## API

- `POST /api/quant/decision-assistant`：创建一次评估。请求包含 `research_run_id`、`mode`、holding 模式下的 `cost_basis`，以及可选 `quantity`、`include_ai`；服务端在创建时并行读取实时行情和本地最新日线。
- `GET /api/quant/decision-assistant/:tsCode`：读取当前用户该股票最近的评估快照，默认最多返回 10 条。
- 接口按当前认证用户查询研究 run 和快照；研究 run、报告和用户场景不匹配时拒绝。
- AI 阶段失败时仍返回并保存 `ai.status = failed` 的确定性结果；重试通过再次创建评估实现，避免覆盖历史。

## 持久化

新增 `quant_decision_assessment` 表，包含用户、股票、研究 run、场景模式、服务端价格/成本、可选数量、确定性快照、AI 快照和创建时间。以用户和股票建立查询索引，D1 读回是接受评估结果的唯一来源。快照 JSON 版本化，未知版本、未知因子、非有限数字和非法 evidence key 在读回时拒绝。

## AI 合并门槛

AI 必须返回场景动作、推荐方向、置信度、理由、风险、失效条件和 evidence 引用。AI 只能引用研究报告已有 evidence；至少覆盖一个可用因子且置信度不低于 60、报告 coverage 不低于 80、引用非空、方向无冲突时才允许 `final.source = ai`。否则 `final.source = deterministic`，并给出拒绝原因。

## UI

在已有研究详情的决策推荐下加入助手面板：用分段控件切换“准备买入/已持有”，当前价由服务端自动刷新，持有模式显示成本价和可选数量；结果区固定显示动作、可信度、行情来源/时间、覆盖度、价格区间、浮亏/回本幅度、AI 纳入状态和下一步核对条件。窄屏下所有结果字段和错误信息允许换行，不产生页面级横向滚动。
