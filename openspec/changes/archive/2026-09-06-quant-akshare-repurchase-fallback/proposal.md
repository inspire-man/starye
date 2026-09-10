# 提案：接入 AkShare 回购备用来源

## 背景

Quant 股东回报已经接入 Eastmoney 回购计划接口，但部分证券的 Eastmoney 返回合法空结果或临时来源错误，导致回购证据显示为数据不足或来源不可用。AkShare 的 `stock_repurchase_em` 提供同一公开市场的回购计划、计划金额和已实施数量/金额，可用于补充真实原始字段。

## 目标

- 在 AkShare bridge 中按请求股票过滤并标准化回购记录。
- 在 Eastmoney 返回空历史或发生可分类 provider 错误时最多调用一次 AkShare 回退。
- 保留金额、数量、日期和进度的 `null` 语义，不用计划金额推算已实施金额，不把合法空历史伪装成来源失败。
- 让 API、研究报告和 Quant 客户端展示实际命中的 `akshare` 来源及安全回退原因。

## 非目标

- 不改变股东回报、证据覆盖、价值质量、因子权重或推荐公式。
- 不把没有回购记录的证券填充为零值。
- 不新增 D1 表或把 AkShare 原始回购表持久化到用户工作区。

## 影响与风险

改动跨越 Python bridge、API provider chain、响应 schema、Quant parser 和研究来源描述。`QuantRepurchaseProvider` 是 HIGH 扇出接口，保持其方法和返回结构稳定，只扩展 provider 名称与可选 bridge 字段。AkShare 全量回购表的查询成本较高，bridge 每次请求最多执行一次并在内存中按证券代码过滤；若上游异常，既有 Eastmoney 错误仍以安全错误码呈现。

## 需求

1. Bridge MUST 返回与请求股票匹配的回购记录；无匹配记录 MUST 返回空历史，不生成零值。
2. Provider chain MUST 将 Eastmoney 的合法空历史和 provider 失败分别处理：前者允许 AkShare 补充，后者允许 AkShare 兜底，并在成功结果中标记 `provider=akshare`、`fallbackUsed=true` 和安全 `fallbackReason`。
3. API 与客户端 MUST 接受 `akshare` 回购来源，同时保留旧 Eastmoney/Tushare 响应兼容性。
4. 两端均无可用记录时 MUST 保留现有不可用/数据不足边界，不能生成推算金额。
