## 数据流

1. bridge 默认请求 `include_profit_forecasts=true` 时先调用 `stock_profit_forecast_ths(symbol=<code>, indicator="预测年报每股收益")`。
2. 同花顺没有有效记录或端点失败时，bridge 使用 `stock_profit_forecast_em(symbol="")` 的短 TTL 全市场结果，按股票代码过滤并从带年份列中读取预测 EPS。
3. normalizer 统一预测年度、EPS 均值/上下限、预测机构数和行业均值；所有非有限数值保留为 `null`，不从 EPS 推导利润或价格。
4. API parser 将 `profit_forecasts` 缺失解析为空列表，以兼容旧 bridge；研究报告把每个有效年度记录映射为可选 `akshare-profit-forecast-*` evidence。
5. source provenance 保留实际端点；主源成功时不标记回退，备用命中时错误列表仍保留安全诊断信息。

## 边界

- 预测 EPS 是每股收益口径，不映射为 `consensusProfit`，也不与财报 `netProfit` 合并。
- 预测年度不是财报报告期；evidence 的 `observedAt` 使用 bridge 观测时间，`forecastYear` 保留在 detail 和 key 中。
- 证券代码不匹配、年份缺失、所有预测数值为空或上游返回非 JSON 时，记录稳定 `AKSHARE_PROFIT_FORECAST_*` 错误，不泄漏上游正文。
- 旧响应没有 `profit_forecasts` 时，API、研究报告和现有财务/股东回报行为保持不变。

## 验证

- Python normalizer/adapter/server 测试覆盖 THS 主源、Eastmoney fallback、动态年份列、代码过滤、空值和错误脱敏。
- API bridge tests 覆盖旧 payload、字段归一化和 evidence source provenance；research-report tests 覆盖预测 EPS 仅为 optional evidence。
- 运行真实 `601899` AkShare 预测样本、Python/API/Quant tests、type-check/build/lint、OpenSpec strict、GitNexus detect changes 和 Gateway 匿名边界。
