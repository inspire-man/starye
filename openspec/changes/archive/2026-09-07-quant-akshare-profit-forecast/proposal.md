## Why

Quant 当前“预期差”因子只有已实现业绩、TTM 估值和趋势证据，缺少可追溯的远期预测原始字段。AkShare 已验证可返回 601899 的年度预测每股收益、预测机构数、上下限和行业均值，适合先补充独立的预测 EPS 证据，解决“预测来源缺失”和“预测字段被误当作实际利润”的边界问题。

## What Changes

- bridge 接入同花顺 `stock_profit_forecast_ths` 预测 EPS，并以 Eastmoney `stock_profit_forecast_em` 全市场结果作为备用来源。
- 新增可选 `profit_forecasts` 响应记录，保留预测年度、预测 EPS 均值/上下限、机构数、行业均值和实际来源端点。
- API 解析旧 bridge payload，研究报告显示独立的 AkShare 预测 EPS 可选 evidence 和 source provenance。
- 预测 EPS 只作为远期研究证据，不换算预测净利润、不进入价值质量评分、不覆盖财报实际值。
- 保留端点失败、空结果、非有限值和证券代码不匹配的安全错误边界。

## Capabilities

### New Capabilities

- `quant-akshare-profit-forecast`: AkShare 预测 EPS bridge contract、研究 evidence 和来源可追溯性。

### Modified Capabilities

- 无。现有价值质量评分和股东回报公式保持不变。

## Impact

- 影响 `apps/quant-akshare-bridge` contract/normalizer/adapter/server、API AkShare bridge parser、研究报告 builder、Quant research parser 和投资知识字段展示。
- 不修改 D1 schema、Quant 路由路径、认证边界或现有 provider 主链。
- 预测数据源可能返回全市场分页结果，bridge 仅缓存短时间原始结果并过滤请求证券；来源失败保留安全错误码，不阻断本地确定性报告。
