# Quant AkShare 分红历史备用来源 Specification

## Purpose

为 Quant 股东回报补充分红历史来源，区分真实实施分红、合法空历史和 provider 不可用。

## ADDED Requirements

### Requirement: Bridge MUST 输出标准化分红明细

AkShare bridge MUST 调用 `stock_history_dividend_detail` 并只返回请求证券的分红记录。每条记录 MUST 暴露公告日期、实施进度、每股现金分红和除权除息日，并在上游提供时保留派息日；AkShare 每十股现金字段 MUST 除以 10，缺失原始字段 MUST 保持 `null`。

#### Scenario: 已实施分红记录

- **WHEN** endpoint 返回请求证券的公告日期、派息、实施状态和除权除息日
- **THEN** bridge 返回一条 `dividends` 记录
- **AND** `cash_div` 是原始每十股派息除以 10 的每股金额
- **AND** `div_proc` 为 `实施` 且 `source.endpoints` 包含 `stock_history_dividend_detail`

#### Scenario: 预案或无效行

- **WHEN** endpoint 返回预案、缺失日期或 `NaT` 字段
- **THEN** 预案不得进入已实施分红计算
- **AND** 缺失字段为 `null`，无有效事件日期的行产生安全分类错误

### Requirement: Provider chain MUST 在空历史或失败时回退

Quant MUST 保持 Tushare/Eastmoney 为主链，并在主链返回空历史或可分类错误时最多调用一次 AkShare。AkShare 命中有效记录时 MUST 暴露 `provider=akshare`、`fallbackUsed=true` 和安全 `fallbackReason`。

#### Scenario: 主源空历史后 AkShare 命中

- **WHEN** Tushare/Eastmoney 返回合法空历史且 AkShare 返回实施记录
- **THEN** 使用 AkShare 记录计算股息率
- **AND** `fallbackReason` 为 `QUANT_PROVIDER_EMPTY`

#### Scenario: 主源失败后 AkShare 命中

- **WHEN** 主源超时、配额耗尽或响应无效且 AkShare 返回实施记录
- **THEN** 使用 AkShare 记录
- **AND** `fallbackReason` 为主源的安全 provider 错误码
- **AND** 不渲染原始异常文本

#### Scenario: 所有来源均为空

- **WHEN** Tushare、Eastmoney 和 AkShare 都返回合法空历史
- **THEN** 分红记录为空且股东回报保持 `insufficient_data`/`partial` 的既有边界
- **AND** 不生成零值分红

### Requirement: 来源元数据 MUST 贯穿 API 与研究报告

API schema、Quant client parser、研究报告 source 和详情来源展示 MUST 接受 `akshare`。现有股息率、近 12 个月筛选和分红年数公式 MUST 保持不变。

#### Scenario: AkShare 分红进入详情与报告

- **WHEN** provider chain 使用 AkShare 实施分红记录
- **THEN** API 与客户端保留 `provider=akshare`
- **AND** 详情与研究报告显示 AkShare 分红来源
- **AND** 推荐、证据覆盖和价值质量不因 provider 名称扩展改变

### Requirement: 旧 bridge 响应 MUST 保持兼容

API MUST 接受没有 `dividends` 字段的旧 `quant-akshare-v1` bridge 响应，并将其解析为空列表；日线、财务、现金流和回购字段行为保持不变。

#### Scenario: 旧 bridge payload

- **WHEN** bridge 响应没有 `dividends`
- **THEN** AkShare dividend provider 返回空记录
- **AND** 其他 provider parser 与数据字段继续正常工作
