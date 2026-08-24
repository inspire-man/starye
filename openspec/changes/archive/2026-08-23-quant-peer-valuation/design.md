## Comparison contract

- 在 `apps/api/src/domain/quant/provider.ts` 复用现有 Eastmoney valuation provider，不新增上游字段。
- 在 `apps/api/src/routes/quant/index.ts` 增加 `GET /api/quant/valuation/compare/:tsCode`。
- 路由读取当前 `quant_watchlist`，并发读取每个股票的估值快照；目标股票不在观察池时返回 404。
- 响应包含目标快照、每个成功读取的观察池股票摘要、`sampleCount`、`availableSampleCount`、`ttmPeHigherThanPercent` 和 `pbHigherThanPercent`。
- 相对位置的分母为“目标指标非空的其他观察池样本数”，目标自身不参与比较；目标指标为空或有效比较样本少于 2 时位置为 null。

## API and client

- 使用 Valibot 定义比较项和响应 schema，字段全部显式 nullable。
- 前端 client 只消费 Gateway Quant API，不直接请求 Eastmoney。
- 估值速览加载比较接口后使用其目标快照，避免同一股票重复发起目标估值请求。

## Workbench presentation

- 在估值速览下增加两行：TTM PE 相对观察池、PB 相对观察池。
- 只显示“高于观察池 X%”或“暂无足够样本”，同时显示“样本 N 只”。
- 位置颜色使用中性 token，不将高低直接标成好坏；旁边保留“仅当前观察池，不代表行业估值”的解释。
- 移动端两列指标下方堆叠相对位置，保持无横向溢出。

## Verification

- route 测试覆盖认证、目标不在观察池、完整样本、缺失指标和上游部分失败。
- client 测试覆盖 snake_case、null 和相对位置解析。
- 运行 API/Quant 测试、lint、type-check、build、OpenSpec strict，以及 Gateway 桌面/390px smoke。
