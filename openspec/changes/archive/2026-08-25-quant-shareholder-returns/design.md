## 设计边界

- 复用 `QuantFinancialQualitySnapshot` 和现有 Eastmoney 财报请求，不新增数据库表。Eastmoney 的 `FCFF_BACK`/`FCFF_FORWARD` 以报告源字段名映射为 `fcffBack`/`fcffForward`，避免将来源字段误称为已验证的自由现金流计算。
- 在 `provider.ts` 中抽出通用的 Tushare 行请求，并新增只读 `createTushareDividendProvider`。现有 daily provider 的请求、错误码和 token 行为保持不变。
- 新的股东回报 domain service 读取观察池和 `quant_daily_bar`，按有限并发请求分红；它把实施记录按报告期和实施日期去重，仅将观察日往前 365 天内的有效现金分红纳入 trailing 计算。
- 报告结果采用 `ready`、`partial`、`insufficient_data` 三态。分红接口未配置时不抛出整批错误，而是每项返回来源不可用和缺失字段。
- API 路由沿用现有 `requireAuth`、`{ success: true, data }` envelope 和 Quant 错误映射；前端 client 做 snake_case/camelCase 归一化，避免把上游字段直接暴露到 Vue。
- UI 只在 DetailDrawer 中增加两个紧凑数据区；使用已有 Quant shell token、状态色和响应式 grid。数据缺失显示 `--`/缺口文案，不隐藏数据源状态。

## 计算规则

设观察日为 `T`，最新本地收盘价为 `P_T`，每条已实施分红记录的现金分红/股为 `d_i`，有效支付日优先取支付日、否则取除权日 `D_i`：

```text
trailingCashDividendPerShare = sum(d_i where T - 365 days < D_i <= T)
trailingDividendYield = trailingCashDividendPerShare / P_T * 100
```

当 `P_T <= 0`、没有有效 `D_i` 或没有已实施现金分红时，相关结果为 `null`。年度数只统计近五个报告年度中至少有一条已实施现金分红的不同 `end_date` 年份。该指标只作为研究上下文，不参与 `value-quality-v1`。

## 验证

- provider 测试覆盖 Tushare 请求字段、实施记录过滤、Eastmoney 新字段解析和空值保持。
- domain/route 测试覆盖认证、单只失败隔离、股息率公式和观察池价格缺失。
- Quant client/组件测试覆盖响应归一化、缺失态和报告期展示。
- 运行 API/Quant type-check、定向 Vitest、build 和 `http://localhost:8080/quant/` 浏览器验收。
