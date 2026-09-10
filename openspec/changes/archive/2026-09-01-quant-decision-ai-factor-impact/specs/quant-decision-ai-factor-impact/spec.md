# Quant 决策助手因子影响 Specification

## Purpose

让用户在今日决策助手中直接核对确定性因子贡献与 AI 实际影响范围，避免只看到 AI 最终动作而缺少权重和证据边界。

## ADDED Requirements

### Requirement: 决策助手必须返回可审计的因子影响

决策助手创建和历史读取响应 MUST 返回由研究报告快照与已接受 AI 因子复核派生的 `factorImpact`；每个有权重因子 MUST 包含确定性分数、确定性贡献、报告权重和 AI 实际纳入权重。

#### Scenario: 已完成 AI 复核

- **WHEN** 决策助手包含已保存且服务端接受的因子复核
- **THEN** 响应返回对应因子的 `aiAccepted` 和 `aiWeight`
- **AND** 汇总返回 AI 复核覆盖比例及支持、注意、反对权重

#### Scenario: AI 缺口或失败

- **WHEN** AI 未请求、配置不可用、复核失败或因子复核未达到接受门槛
- **THEN** 对应因子的 `aiWeight` 为 0
- **AND** 确定性贡献仍按报告快照返回

### Requirement: 因子影响必须与最终判断隔离

`factorImpact` MUST 作为审计派生字段返回，且 MUST 保持决策助手的 `final`、确定性动作、可信度和参考买卖区间不变。

#### Scenario: 历史快照回读

- **WHEN** 历史快照只保存 `ai.factorReviews` 或没有新派生字段
- **THEN** API 根据当前报告与快照复核重新生成 `factorImpact`
- **AND** 原有场景价格、确定性结果和最终来源保持一致

### Requirement: 决策助手界面必须显示 AI 影响边界

决策助手结果区 MUST 显示确定性贡献与 AI 实际权重的区别，并 MUST 让用户识别已计入、未计入和未复核的因子。

#### Scenario: 用户查看场景判断

- **WHEN** 用户打开包含因子模型的决策助手结果
- **THEN** 页面显示 AI 覆盖比例、方向权重和逐项因子影响
- **AND** 页面明确 AI 影响是审计范围，不是对确定性分数的改写

### Requirement: 旧客户端和窄屏必须保持可用

客户端 MUST 接受缺少 `factorImpact` 的历史响应并保留原有结果；新增字段在 390px 宽度下 MUST 在容器内换行，不产生页面级横向溢出。

#### Scenario: 读取旧格式快照

- **WHEN** 客户端收到缺少 `factorImpact` 的历史决策助手响应
- **THEN** 客户端保留原有最终判断和 AI 复核信息，并将因子影响视图标记为不可用

#### Scenario: 窄屏查看因子审计

- **WHEN** 用户在 390px 宽度查看包含因子影响的决策助手结果
- **THEN** 因子摘要和逐项信息在容器内换行
- **AND** 页面不产生横向溢出
