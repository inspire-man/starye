## 设计目标

本 change 复用现有股东回报请求和详情结构，在 `cashflowEvidence` 旁增加可选的 `capitalStructureEvidence`。provider 只负责规范化 Eastmoney 原始事件，domain 负责相邻事件差值和回购股数汇总，UI 只展示已接通的事实及金额缺口。

## Provider 边界

- 在 `provider.ts` 增加 `QuantCapitalStructureReport`、`QuantCapitalStructureRequest`、`QuantCapitalStructureProvider` 和 `createEastmoneyCapitalStructureProvider`。
- 请求 `GET /PC_HSF10/CapitalStockStructure/PageAjax?code=SH601899`，解析 `lngbbd`，默认读取最近 12 条并按 `reportDate` 降序去重。
- 每条报告保留 `SECURITY_CODE` 校验后的 `tsCode`、规范化 `END_DATE`、`TOTAL_SHARES` 和 `CHANGE_REASON`。空总股本保持 `null`，非法日期、代码错位、坏 JSON、非 2xx 和超时映射为现有 Eastmoney provider 错误。
- `CHANGE_REASON` 只作为来源文字保留。domain 只有在相邻总股本均为有限值且原因包含“回购”时，才记录回购导致的股数减少；不读取或推算回购金额。

## Domain 证据

`QuantShareholderCapitalEvidence` 使用 `shareholder-capital-v1` 公式版本和 `ready`、`partial`、`insufficient_data`、`unavailable` 状态：

- 有最新及上一条相邻报告的有限总股本时为 `ready`。
- 有报告但相邻总股本、日期或事件字段不足时为 `partial`。
- provider 返回空历史时为 `insufficient_data`。
- provider 异常时为 `unavailable`，保留安全错误码。

证据返回最新总股本、上一条总股本、股本变化和变化比例；`changes` 保留每条历史报告及其相邻变化。`repurchaseSharesRetired` 只表示标记为回购且总股本下降的股数绝对值汇总，单位为股。回购金额始终进入 `missingFields`，不参与状态降级。

股息、现金流和股本三个 provider 在单只读取中同时启动；每路通过独立的 `catch` 归一化错误，保证已成功的其他证据继续返回。批量并发上限仍由现有股东回报服务控制。

## Contract、研究和 UI

- `QuantShareholderReturnItem` 增加可选 `capitalStructureEvidence`，旧报告没有该区域时仍可解析。
- 研究报告增加可选的 `shareholder-shares-outstanding-change` 和 `shareholder-repurchase-shares` 证据，以及对应 Eastmoney 股本来源；两项均标记为 optional。
- 投资知识目录把已接通的 `payoutRatio`、`freeCashflow`、`sharesOutstandingChange` 标为 available，保留 `buybackAmount` 缺口。
- 详情页增加紧凑的股本证据区域：最新总股本、最近变化、回购注销股数、事件原因和报告日期；显示“回购金额仍未接通”的明确说明。
- value-quality、factor configuration、decision projection、research action 和 recommendation 逻辑不读取新字段。

## 验证策略

provider 测试覆盖路径、代码、日期、空值、排序、回购原因和错误映射；domain 测试覆盖增发/回购/无变化、负变化比例、空历史和局部失败；route integration 覆盖新嵌套区域与旧分红/现金流结果共存；client/UI 测试覆盖旧 payload、ready/partial/unavailable 和 390px 布局。最后经 Gateway `http://localhost:8080/quant/` 做匿名边界和认证详情验证。
