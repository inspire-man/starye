# 设计

## 报告边界

新增 `apps/api/src/domain/quant/research-report.ts`，只负责把已取得的数据转换为稳定的研究报告，不负责网络请求和数据库写入。输入由路由组装：

- 当前用户观察池中的股票与最新日线。
- 最新候选快照或从本地日线重新计算的候选。
- Eastmoney 估值和最近财报历史。
- Tushare 实施分红结果（缺失时保留缺口）。

报告版本为 `research-report-v1`。报告包含：

- `status`: `ready`、`partial`、`insufficient_data`。
- `action`: `research-window`、`wait-confirmation`、`reassess`、`complete-data`。
- `score`: 由必需证据中通过项占比得到的 0-100 分，不是收益预测。
- `evidence[]`: 趋势、估值、质量、股东回报和风险证据。
- `strengths`、`risks`、`gaps`、`nextActions`。
- `sources[]`: 来源名称、观察时间、公式版本和快照身份。

每条证据包含 `key`、`dimension`、`label`、`status`、`value`、`threshold`、`source`、`observedAt`、`formulaVersion` 和 `detail`。原始数值保留在 `value`，显示文案不参与计算。

## 计算规则

- 日线样本 `>= 60` 为 `pass`，`20-59` 为 `caution`，更少为 `missing`。
- 收盘价不低于 MA20、20 日收益不为负、60 日回撤大于 `-15%` 作为趋势门槛。
- TTM PE、PB 有效且为正时进入估值证据；缺失为 `missing`，避免伪造估值结论。
- 最新财报的净利润同比、ROE、经营现金流/营收分别按 `>= 0%`、`>= 10%`、`>= 0%` 判断；财报少于 2 期时追加连续性缺口。
- 已实施分红产生可选的股东回报证据，不把没有 provider 当作零股息。
- 成交量比 `>= 3` 或连续上涨 `>= 7` 触发风险 `fail`，中间区间为 `caution`。
- 必需证据缺失时 action 为 `complete-data`；至少两个必需证据失败或价值质量风险扣分达到 5 时为 `reassess`；其余存在 caution/fail 时为 `wait-confirmation`；全部必需证据通过时为 `research-window`。

## 持久化与 API

`quant_research_run` 保存 `id`、`user_id`、`ts_code`、`name`、`status`、`report_version`、`source_snapshot_id`、`report_json`、`generated_at` 和 `created_at`。报告正文作为版本化 JSON 快照保存，所有读取均带 `user_id` 条件。

- `POST /api/quant/research/runs`：body `{ ts_code }`，生成并保存一次报告。
- `GET /api/quant/research/runs/:tsCode?limit=5`：读取当前用户该股票的最近运行。

生成过程先检查股票属于当前用户观察池，再读取数据；上游单项失败降级到证据状态，不阻塞其他证据。数据库 readback 后才返回 `run`。

## 前端

分析抽屉在 `DECISION CARD` 下增加研究报告区：显示最新报告状态、分数、研究动作、优势/风险/缺口和证据行；提供生成按钮与最近运行时间。报告生成期间按钮禁用，失败显示原有错误 envelope，空状态引导用户先生成报告。窄屏保持纵向证据行和横向不溢出。

## 后续 bridge 边界

后续 AkShare bridge 只需要输出与报告输入兼容的标准化 provider 结果，并在 `sources[]` 中记录来源和观察时间。Worker 不执行 Python，也不直接解析 AkShare DataFrame。未来 AI agent 读取报告证据和来源快照后只能生成解释性摘要，不能覆盖确定性状态或原始数值。
