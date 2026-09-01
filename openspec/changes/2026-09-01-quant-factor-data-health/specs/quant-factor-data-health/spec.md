# Quant 因子数据健康 Specification

## Purpose

让用户在研究详情中快速识别每个因子的原始数据是否齐全、来源是否回退、缺少哪些 evidence，以及下一步应该补什么。

## ADDED Requirements

### Requirement: 因子数据健康必须基于原始证据

Quant MUST 从当前研究报告的正权重因子和 evidence 派生版本化的因子数据健康结果；每个因子 MUST 返回字段状态、权重、来源、观察时间、可用证据计数和缺失/失败 key。

#### Scenario: 因子证据完整

- **WHEN** 正权重因子的状态为 ready，且其引用证据全部为 pass 或 caution
- **THEN** 因子数据健康显示 ready 和可用证据计数
- **AND** 汇总按该因子权重计算已就绪权重，不改写因子分数

#### Scenario: 因子证据缺失或失败

- **WHEN** 因子引用的 evidence 缺失、失败、找不到或因子状态为 partial/missing
- **THEN** 因子数据健康显示 partial 或 missing，并列出可识别的 evidence key
- **AND** 页面给出补齐或重试该来源的下一步动作

### Requirement: 来源回退必须与字段完整性分开

来源名称包含回退、配额、失败或不可用提示时，系统 MUST 单独返回来源健康标记；来源回退 MUST NOT 被伪装为主来源完全健康，也 MUST NOT 把已有原始字段推导为零。

#### Scenario: 使用回退来源

- **WHEN** 因子字段可读取但来源名称包含回退链或配额提示
- **THEN** 页面同时显示字段状态和“来源需复核”提示
- **AND** 用户能看到来源名称与观察时间

### Requirement: 因子数据健康必须与判断隔离

因子数据健康 MUST NOT 修改确定性因子分数、因子权重、研究推荐、AI 最终判断或参考价格区间。

#### Scenario: 数据健康不完整

- **WHEN** 一个或多个因子数据缺失
- **THEN** 页面保留原有确定性推荐和价格区间
- **AND** 健康区只展示缺口与补齐指引

### Requirement: 窄屏展示必须可核对

因子数据健康区在 390px 宽度下 MUST 让来源、evidence key 和补齐动作在容器内换行，不产生页面级横向溢出。

#### Scenario: 窄屏查看来源

- **WHEN** 用户在 390px 宽度查看长来源名和多个 evidence key
- **THEN** 因子行在区域内单列换行
- **AND** 页面不发生横向滚动
