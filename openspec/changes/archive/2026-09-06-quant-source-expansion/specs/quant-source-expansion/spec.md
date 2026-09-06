## Purpose

让 Quant 在主来源只返回部分财报或现金流字段时，能够通过可配置的 AkShare bridge 进行逐字段补充，并把来源配置、端点失败和最终采用的报告期保留为可核对证据。

## ADDED Requirements

### Requirement: AkShare bridge MUST provide additive financial and cashflow source data

当 AkShare bridge 已配置并请求财报或现金流数据时，bridge MUST 返回版本化、可校验的标准化记录。财报记录 MUST 至少保留报告期和已识别的基础质量字段；现金流记录 MUST 至少保留报告期、经营活动净现金流、购建长期资产支出和现金流量表净利润的原始或显式 `null` 值。每日、身份、财报和现金流端点 MUST 按端点分别记录错误，单端点失败不得伪造其他端点的成功数据。

#### Scenario: 财报和现金流端点均成功

- **WHEN** bridge 返回有效证券代码、报告期和标准化财报/现金流记录
- **THEN** response 保留 `financials` 和 `cashflows` 的报告期与有限数值
- **AND** `source.endpoints` 列出实际成功或尝试的端点
- **AND** response 不包含请求 token、请求体或上游异常原文

#### Scenario: 单个端点失败

- **WHEN** AkShare 财报成功但现金流端点超时或不存在
- **THEN** response 保留有效财报记录
- **AND** `errors` 包含稳定错误码和端点标识
- **AND** 现金流字段保持空集合，不用财报字段推导现金流

### Requirement: AkShare data MUST supplement matching primary reports only

API provider 链 MUST 在主来源返回合法报告后，才使用已配置的 AkShare bridge 对同一 `reportDate` 的 `null` 字段进行补充。主来源已有的有限值、报告期、公告日期、行业分类和行业专用指标 MUST 保持不变；AkShare 只能写入经过有限数值和报告期校验的空字段，并 MUST 暴露 `supplementalProvider=akshare` 与 `supplementUsed=true`。

#### Scenario: 同报告期补充财报字段

- **WHEN** Eastmoney 返回报告期 `2026-06-30` 且毛利率为空，AkShare 返回同报告期有限毛利率
- **THEN** API 返回该毛利率并保留 Eastmoney 的其他字段
- **AND** 结果标记 AkShare 为字段补充来源
- **AND** 不改变 Eastmoney 的行业分类或已有数值

#### Scenario: 报告期不匹配

- **WHEN** 主来源报告期为 `2026-06-30` 而 AkShare 只有 `2025-12-31`
- **THEN** 主报告的空字段继续保持 `null`
- **AND** 不把跨期值写入当前报告
- **AND** AkShare 记录可以作为独立来源保留，但不得提升该报告的字段覆盖

### Requirement: Provider failure and configuration states MUST remain explicit

AkShare bridge 未配置时 provider MUST 不发起请求，并保留现有主来源结果和缺失状态。bridge 配置但所有目标记录为空、响应无效、超时或上游失败时，provider MUST 返回安全的来源错误或空历史；不得以零值、上一期值、其他证券或跨端点推导值填充。主来源和 AkShare 都失败时，现有 Quant provider error contract MUST 保持不变。

#### Scenario: bridge 未配置而主来源有部分字段

- **WHEN** `QUANT_AKSHARE_BRIDGE_URL` 或 `QUANT_AKSHARE_BRIDGE_TOKEN` 缺失，主财报返回部分字段
- **THEN** API 不请求 bridge
- **AND** 主财报及其缺失字段原样保留
- **AND** 页面提示配置或重试来源，而不显示虚假的补充成功

#### Scenario: 主来源失败且 bridge 返回完整报告

- **WHEN** Eastmoney/Tushare 主财报读取失败，AkShare 返回同证券的有效财报
- **THEN** API 返回 AkShare 报告并标记 `fallbackUsed=true`
- **AND** `fallbackReason` 只包含稳定的 Quant provider 错误码

#### Scenario: 两个来源都没有有效记录

- **WHEN** 主来源和 AkShare 都返回空集合或错误
- **THEN** 财报或现金流状态保持缺失/不可用的可解释状态
- **AND** 不创建零值或推算值
