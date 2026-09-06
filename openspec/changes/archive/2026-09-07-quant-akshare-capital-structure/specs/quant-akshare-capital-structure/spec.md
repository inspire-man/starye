# Quant AkShare 公司股本结构来源 Specification

## ADDED Requirements

### Requirement: Bridge MUST normalize company capital events

AkShare bridge MUST 使用 `stock_share_change_cninfo` 读取公司级股本变动，只保留请求证券的 `变动日期`、有限 `总股本` 和 `变动原因`。股东持仓端点、基金持仓和其他证券记录 MUST 不进入 `capital_structures`。

#### Scenario: CNInfo 返回公司总股本变动

- **WHEN** CNInfo 返回请求证券 `601899` 的变动日期、总股本和变动原因
- **THEN** bridge 返回标准化 `capital_structures` 记录
- **AND** report date、total shares 和 reason 保留真实值
- **AND** source endpoints 包含 `stock_share_change_cninfo`

#### Scenario: 代码不匹配或字段非有限

- **WHEN** CNInfo 返回其他证券、无效日期或 `NaN` 总股本
- **THEN** 该行不进入结果或非有限字段为 `null`
- **AND** bridge 写入稳定 `AKSHARE_CAPITAL_*` 错误，不泄漏上游异常正文

### Requirement: Capital provider MUST fallback and preserve provenance

Quant MUST 保持 Eastmoney 为公司股本结构主来源，并在主来源空历史或可分类失败时回退 AkShare。回退命中时报告和股东回报 evidence MUST 暴露 `provider=akshare`；主源有限报告 MUST 优先保留。

#### Scenario: Eastmoney 空历史后 AkShare 命中

- **WHEN** Eastmoney 返回合法空 `capital structure` 历史且 AkShare 返回公司总股本事件
- **THEN** API 使用 AkShare 事件计算股本变化
- **AND** 股本 evidence provider 为 `akshare`
- **AND** 不把空历史转换为零值或来源成功

#### Scenario: 所有来源不可用

- **WHEN** Eastmoney 失败且 AkShare 失败或无有效事件
- **THEN** 股本 evidence 保持 `unavailable` 或 `insufficient_data`
- **AND** 保留安全 provider error code

### Requirement: Existing capital formulas and contracts MUST remain stable

Quant MUST 保持 `QuantCapitalStructureReport` 的 report date、total shares、change reason 语义，以及相邻总股本差值、变化比例和回购减少累计公式。旧 bridge payload 没有 `capital_structures` 时 MUST 解析为空列表。

#### Scenario: AkShare 股本进入详情与研究报告

- **WHEN** 股本 provider 使用 AkShare 事件生成 shareholder return
- **THEN** 详情和研究报告显示 AkShare 股本来源
- **AND** 现有股本变化、回购股数、推荐和 D1 行为保持不变
