# 设计：AkShare 分红历史备用来源

## 数据流

`GET /api/quant/shareholder-returns` 和研究报告继续复用现有 dividend provider。默认链保持 Tushare → Eastmoney，并在该链返回空历史或失败时最多调用一次已配置的 AkShare bridge provider。bridge 请求仍使用 `POST /v1/evidence`，Python adapter 调用 `stock_history_dividend_detail(symbol=<六位代码>)`，按请求股票返回的明细行转换为 `dividends`。

## Bridge 合同与字段映射

`BridgeResponse.dividends` 为可选字段，保证旧的 `quant-akshare-v1` 响应继续可被 Worker 解析。记录使用现有分红报告的 snake_case：

- `公告日期` → `ann_date`，同时作为 AkShare 可提供的 `end_date` 事件日期，不推造报告年度。
- `派息` 是每十股现金分红，除以 10 后写入 `cash_div`；零值保留为零，缺失保持 `null`。
- `进度` → `div_proc`，只有 `实施` 记录可参与现有 trailing dividend 计算。
- `除权除息日` → `ex_date`；当前 endpoint 没有独立现金派息日时 `pay_date` 保持 `null`，若后续响应提供 `红利发放日` 才写入 `pay_date`。

缺失日期、金额或进度不补零；无公告/除权除息/派息日期的行无法满足现有 `end_date` 合同时分类为行错误并丢弃。`NaT`、`NaN` 和空文本按缺失处理。endpoint failure、不可用和日期/行格式错误均只保留安全分类码。

## Provider chain

扩展 `createQuantDividendProviderChain` 的空结果处理：

- 主 provider 有有效记录：直接返回主结果。
- 主 provider 返回空历史且存在下一 provider：继续尝试；下一 provider 有记录时标记 `fallbackUsed=true` 和 `fallbackReason=QUANT_PROVIDER_EMPTY`。
- 主 provider 抛出错误且下一 provider 命中：使用 `mapQuantProviderError` 的安全码作为 `fallbackReason`。
- 所有 provider 都是合法空历史：返回空记录与既有数据不足边界；任何失败仍保留既有 chain error 映射。

`dividendProvider` 将 AkShare chain 放在 Tushare/Eastmoney chain 之后。AkShare 未配置时跳过，不发 bridge 请求。

## API、研究报告与客户端

扩展 `QuantSourceName` 到 dividend provider、shareholder-return item/selection、响应 schema 和 Quant view model。新增 AkShare bridge dividend parser/provider；研究报告 source id 使用 `akshare-dividend`，名称显示 AkShare 实施分红和安全回退原因。客户端同时接受旧的 Tushare/Eastmoney payload 与缺少 `dividends` 的旧 bridge payload。

## 验证

- Python 单测覆盖实施/预案、每十股转换、空日期、NaT、空历史、endpoint 异常和 source endpoint。
- API 单测覆盖 bridge parser/provider、Tushare/Eastmoney 空/失败回退、AkShare 命中、双空和双失败。
- Quant parser、研究来源和回归测试覆盖 `akshare` provider 与旧 payload 兼容。
- 通过 Gateway 验证匿名鉴权边界；使用已验证的本地 bridge fixture 检查 AkShare 分红来源展示和研究报告来源。
