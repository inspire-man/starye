# 设计

## 数据流

1. bridge 在默认请求中调用 `stock_share_change_cninfo(symbol, start_date, end_date)`，默认覆盖最近十年；传入请求日期时沿用请求边界。
2. `normalize_capital_structure_rows` 按证券代码过滤，读取 `变动日期`、`总股本`、`变动原因`，映射为既有 `QuantCapitalStructureReport` 语义；不读取股东持仓数量。
3. API bridge parser 将可选 `capital_structures` 缺失解析为空列表，旧 bridge 继续兼容。
4. `createQuantCapitalStructureProviderChain` 以 Eastmoney 为主，空历史或异常时回退 AkShare；回退报告标记 `provider=akshare`，主源报告保留既有行为。
5. 股东回报 evidence 读取报告实际 provider，股本变化、相邻事件差值和回购减少累计公式不变。

## 边界

- 请求证券代码不匹配、日期无效或总股本非有限时，行被丢弃或字段保持 `null`，写入安全 `AKSHARE_CAPITAL_*` 错误。
- Eastmoney 合法空历史后 AkShare 也为空时，保持 `insufficient_data`；主源失败且回退失败时保留安全 provider 错误码。
- `stock_shareholder_change_ths`、`stock_circulate_stock_holder` 和基金/股东持仓端点不进入公司股本结构链。

## 验证

- Python normalizer/adapter/server 测试覆盖代码过滤、源端点失败、空历史和非有限值。
- API provider/bridge/shareholder tests 覆盖实际 provider、旧 payload、回退和公式不变。
- Quant parser/type-check/build、Gateway 匿名边界、真实 `601899.SH` AkShare 样本和 strict OpenSpec。
