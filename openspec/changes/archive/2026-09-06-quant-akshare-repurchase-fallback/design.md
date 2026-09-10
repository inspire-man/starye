# 设计：AkShare 回购备用来源

## 数据流

`GET /api/quant/shareholder-returns` 继续由现有 handler 构造回购 provider。回购 provider chain 先调用 Eastmoney；返回非空记录时保持 Eastmoney 结果，返回空集合或抛出可分类错误时调用已配置的 AkShare bridge provider。bridge 请求仍复用 `POST /v1/evidence`，Python adapter 在一次 `stock_repurchase_em()` 调用后按六位证券代码过滤，并将行转换为 `repurchases`。

## Bridge 合同

`BridgeResponse.repurchases` 为可选字段，保证旧 bridge 响应可被 API 解析。记录字段使用现有回购报告的 snake_case：`repurchase_code`、`announcement_date`、`start_date`、`end_date`、`finish_date`、`progress`、`planned_amount_lower`、`planned_amount_upper`、`repurchase_amount`、`repurchase_shares`。AkShare 没有稳定计划编号时，用公告日期、开始日期和计划金额区间构造稳定的去重键；不使用全量表行序号。

AkShare 日期字段经过统一日期归一化，时间戳、`date` 和日期字符串都支持；无效日期保留记录但置为 `null` 并产生安全分类错误。代码不匹配的行丢弃并产生 mismatch 错误。无匹配行不产生 endpoint failure。

## Provider chain

新增 `createQuantRepurchaseProviderChain(primary, fallback)`，行为与现金流 chain 的空历史回退一致：

- 主源有记录：直接返回主源。
- 主源为空：调用回退；回退有记录时标记 `fallbackUsed` 和 `fallbackReason=QUANT_PROVIDER_EMPTY`。
- 主源抛错：调用回退；回退有记录时使用映射后的主源安全错误码作为 `fallbackReason`。
- 回退为空：若主源是合法空历史则返回空集合；若主源失败则抛出原错误，保留现有 `unavailable` 映射。

默认回购链为 Eastmoney → AkShare。AkShare 未配置时不发 bridge 请求。

## API 与前端

将 `akshare` 加入 `QuantProviderName`，响应 schema、domain model、client parser 和研究报告 source 映射同步扩展。回购 evidence 继续只作为 optional evidence；状态计算、金额求和和缺口提示保持原规则。研究报告显示 `AkShare 回购计划`，回退失败仍显示安全错误码，不输出异常文本。

## 验证

- Python normalizer/adapter/server 测试覆盖匹配、空历史、无效行、上游异常和 endpoint 只调用一次。
- API 测试覆盖 bridge parser、AkShare provider、Eastmoney 空/失败回退、两端空和错误边界。
- Quant client parser 与研究来源测试覆盖 `akshare`。
- 通过 Gateway 验证有回购记录股票、无匹配股票和 Eastmoney fixture fallback 的来源展示。
