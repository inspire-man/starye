## Why

Quant 股东回报目前已经具备现金分红、自由现金流、支付率和回购导致股本减少的证据，但回购金额仍停留在数据缺口。Eastmoney 回购数据页已有按股票归并的计划记录，同时返回计划金额区间和已实施金额，适合补齐这项可追溯事实。

## What Changes

- 新增 Eastmoney 回购计划 provider，读取 `RPTA_WEB_GETHGLIST_NEW` 的股票代码、计划日期、实施状态、计划金额区间、已实施金额和已实施股数。
- 在股东回报 item 下增加可选 `repurchaseEvidence`，以有限的已实施金额汇总作为 `repurchaseAmount`，并保留每项回购计划记录。
- 计划金额区间只作为计划上下文；尚未实施的计划不进入已实施金额汇总，空值保留为 `null`。
- 扩展研究报告 optional evidence、Quant client/view model/parser、股东回报详情和投资知识目录，将 `buybackAmount` 标为可用。
- 保持价值质量、因子权重、研究优先级、研究动作、推荐和决策助手的既有输入与结果。

## Capabilities

### New Capabilities

- `quant-shareholder-buyback-evidence`: 提供带实施状态、计划区间、已实施金额和来源缺口的回购证据。

### Modified Capabilities

无。现有股东回报接口通过可选嵌套区域扩展，旧结果继续可读。

## Impact

- API：`provider.ts`、`shareholder-return.ts`、Quant market/research handlers、响应 schema 和定向测试。
- Quant：market parser、view model、股东回报详情组件与响应式样式。
- 配置：增加可选 `EASTMONEY_REPURCHASE_BASE_URL`，默认使用 `https://datacenter-web.eastmoney.com`，与历史财报 origin 分离。
- 风险：回购计划可能只有上限/下限而暂无实施金额；来源失败、空记录和未实施计划需要分别显示，不能用计划金额代替已支出金额。
