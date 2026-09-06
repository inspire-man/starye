# Quant AkShare 回购备用来源 Specification

## Purpose

为 Quant 股东回报补充 AkShare 回购计划来源，区分合法空历史、来源回退和真实 provider 故障。

## ADDED Requirements

### Requirement: Bridge MUST 输出匹配的回购记录

AkShare bridge MUST 调用 `stock_repurchase_em` 并只保留请求证券代码的记录。记录 MUST 标准化计划金额上下限、已实施金额、已实施数量、计划开始时间、最新公告日期和实施进度；缺失原始字段保持 `null`。无匹配记录 MUST 返回空 `repurchases`，不得填充零值或把其他证券记录带入结果。

#### Scenario: 有已实施回购记录

- **WHEN** `stock_repurchase_em` 返回请求证券的计划金额、最新公告日期、实施进度、已回购数量和已回购金额
- **THEN** bridge 返回一条 `repurchases` 记录
- **AND** 日期、金额和数量按现有 Quant 回购报告字段归一化
- **AND** `source.endpoints` 包含 `stock_repurchase_em`

#### Scenario: 没有匹配记录

- **WHEN** AkShare 全量回购表不包含请求证券代码
- **THEN** bridge 返回空 `repurchases`
- **AND** 不产生回购 endpoint failure
- **AND** 不把计划或已实施字段写成零值

### Requirement: Provider chain MUST 区分空历史与失败

Quant MUST 以 Eastmoney 为默认回购来源，并在 Eastmoney 返回空历史或抛出安全可分类 provider 错误时最多调用一次 AkShare 回购 provider。AkShare 成功返回记录时 MUST 暴露 `provider=akshare`、`fallbackUsed=true` 和 `fallbackReason`；两端均无记录时 MUST 保持数据不足，主源失败且回退失败时 MUST 保留现有不可用错误映射。

#### Scenario: Eastmoney 空历史后 AkShare 命中

- **WHEN** Eastmoney 返回合法空历史，AkShare 返回请求证券回购记录
- **THEN** 使用 AkShare 记录构建回购 evidence
- **AND** `fallbackReason` 为 `QUANT_PROVIDER_EMPTY`
- **AND** 回购状态由实际记录字段决定

#### Scenario: Eastmoney 失败后 AkShare 命中

- **WHEN** Eastmoney 超时、上游失败或响应无效，AkShare 返回有效记录
- **THEN** 使用 AkShare 记录
- **AND** `fallbackReason` 为 Eastmoney 的安全错误码
- **AND** 不把 Eastmoney 的失败当成空回购记录

#### Scenario: 两端均无记录

- **WHEN** Eastmoney 和 AkShare 都返回合法空历史
- **THEN** 回购 evidence 为 `insufficient_data`
- **AND** provider failure 不被伪造

### Requirement: 来源元数据 MUST 贯穿 API 和研究报告

API schema、Quant client parser 和研究报告 MUST 接受 `akshare` provider；回购金额、计划区间和 evidence optional 边界 MUST 保持不变。研究报告来源名称 MUST 与实际 provider 一致，且不渲染原始异常文本。

#### Scenario: AkShare 回购进入详情与报告

- **WHEN** provider chain 使用 AkShare 记录生成股东回报
- **THEN** API 和客户端保留 `provider=akshare`
- **AND** 回购详情与研究报告显示 AkShare 回购来源
- **AND** 价值质量、证据覆盖、推荐和决策结果不因可选回购来源改动

### Requirement: 旧合同 MUST 保持兼容

API MUST 接受没有 `repurchases` 的旧 bridge 响应和没有 `akshare` provider 的既有 Eastmoney/Tushare 响应。AkShare bridge `repurchases` 字段 MUST 为可选，旧 bridge 仍可提供日线、财务和现金流结果。

#### Scenario: 旧 bridge 响应

- **WHEN** bridge 响应不包含 `repurchases`
- **THEN** API 将其解析为空回购列表
- **AND** 其他 evidence 和 provider 行为保持原样
