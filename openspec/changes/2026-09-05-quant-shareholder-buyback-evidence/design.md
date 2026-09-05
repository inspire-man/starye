## 设计目标

本 change 只补齐 Eastmoney 已实施回购金额的可追溯来源。计划上限/下限帮助用户理解授权规模，但与实际已支出金额分离；回购计划 provider 与分红、现金流、股本 provider 并行读取，单路失败只影响对应证据区域。

## Provider 边界

- 在 `provider.ts` 增加 `QuantRepurchaseReport`、`QuantRepurchaseRequest`、`QuantRepurchaseProvider` 和 `createEastmoneyRepurchaseProvider`。
- 使用 `repurchaseBaseUrl`，默认 `https://datacenter-web.eastmoney.com`；请求 `/api/data/v1/get`，参数为 `reportName=RPTA_WEB_GETHGLIST_NEW`、`columns=ALL`、`source=WEB`、`filter=(DIM_SCODE="<code>")`、按 `UPD,DIM_DATE,DIM_SCODE` 倒序排列。
- provider 保留 `REPURCODE`、`DIM_SCODE`、`SECUCODE`、`UPD`、`REPURSTARTDATE`、`REPURENDDATE`、`FINISHDATE`、`REPURPROGRESS`、`REPURAMOUNTLOWER`、`REPURAMOUNTLIMIT`、`REPURAMOUNT` 和 `REPURNUM` 的规范化结果。
- 股票代码校验失败、坏 JSON、非 2xx、响应 `code/success` 异常和超时映射为现有 Eastmoney provider 错误；不把上游正文或请求参数放入浏览器响应。
- 默认最多读取 12 项计划，按 `REPURCODE` 去重；缺少计划编号时使用规范化日期与计划字段形成稳定去重键。

## Domain 证据

新增 `QUANT_SHAREHOLDER_REPURCHASE_FORMULA_VERSION = shareholder-repurchase-v1` 和 `QuantShareholderRepurchaseEvidence`：

- `repurchaseAmount` 只求和有限 `repurchaseAmount`，没有有效已实施金额时返回 `null`。
- `plannedAmountLower` 与 `plannedAmountUpper` 分别求和有限计划下限/上限，仅用于计划上下文。
- `records` 保留每项计划的金额、股数、实施状态和日期，来源状态由 `ready`、`partial`、`insufficient_data`、`unavailable` 表达。
- provider 有效且至少一项已实施金额有限时为 `ready`；有计划但已实施金额全部缺失时为 `partial`；空记录为 `insufficient_data`；provider 异常为 `unavailable`。
- `missingFields` 固定包含“已实施回购金额”或 provider 安全错误信息；计划金额区间缺失作为上下文缺口，不影响已实施金额状态。

`readShareholderReturnInput` 同时启动四路 provider；已有 dividend/cashflow/capital 结果与 repurchase 结果分别归一化。批量并发上限保持 `QUANT_SHAREHOLDER_RETURN_CONCURRENCY`。

## Contract、研究和 UI

- `QuantShareholderReturnItem` 和 response schema 增加可选 `repurchaseEvidence`；历史 payload 缺少该字段时 client 继续使用旧结果。
- `market-support` 的专用回购工厂读取可选 `EASTMONEY_REPURCHASE_BASE_URL`，测试通过独立 fixture origin 隔离回购接口；共享 `eastmoneyProviderOptions` 的既有返回保持不变。
- 研究报告增加 `shareholder-repurchase-amount` optional evidence，`value` 只读已实施金额，`threshold` 明确计划区间不等于已支出。
- 投资知识目录将 `buybackAmount` 移入 `availableFields`，`missingFields` 保留空数组，股东回报 factor 仍是 `partial` 和非评分维度。
- 详情页在股本区域后增加回购计划区域，分别展示已实施金额、计划区间、计划状态、已实施股数、日期和来源缺口；金额使用人民币元，移动端单列。
- value-quality、factor configuration、research priority/action、recommendation 和 decision projection 不读取 `repurchaseEvidence`。

## 验证策略

provider 测试覆盖请求参数、代码/日期/数字归一化、去重、空计划、未实施计划、错误映射；domain 测试覆盖金额求和、空已实施金额、状态和四路局部失败；route/integration 测试覆盖 envelope、旧区域共存、研究来源和用户隔离；client/UI 测试覆盖 camelCase/snake_case、null、ready/partial/unavailable、计划与已实施金额分离及 390px 布局。最后通过 Gateway `http://localhost:8080/quant/` 进行匿名边界和认证详情检查。
