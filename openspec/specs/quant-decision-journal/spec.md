# quant-decision-journal Specification

## Purpose
TBD - created by archiving change 2026-08-30-quant-decision-journal. Update Purpose after archive.

## Requirements

### Requirement: 用户级决策记录

系统 MUST 为认证用户提供一份绑定研究 run 的决策记录，action 只能是 `watch`、`plan-buy`、`holding` 或 `sold`，备注为空或最多 500 个字符。每个用户和研究 run 的组合 MUST 至多存在一条记录。

#### Scenario: 保存当前判断

- **WHEN** 用户为自己拥有的研究 run 提交合法 action 和 note
- **THEN** API 保存记录并返回 `id`、股票代码、action、note、createdAt、updatedAt 和服务端生成的 snapshot
- **AND** snapshot 至少包含报告版本、报告生成时间、推荐、置信度、覆盖度、保存时最新日线价格/日期、买卖区间、AI 决策复核摘要和因子配置快照

#### Scenario: 重复保存同一研究 run

- **WHEN** 用户再次为同一研究 run 保存新的 action 或 note
- **THEN** API 更新原记录而不是创建第二条记录
- **AND** 原记录的 `createdAt` 保留，`updatedAt` 更新并从 D1 读回

### Requirement: 服务端快照与用户边界

系统 MUST 根据认证用户可见的研究 run 读取报告；客户端提交的股票代码、推荐、价格、AI 内容和因子配置字段 MUST 不作为写入来源。最新日线和最新已保存 AI 摘要缺失时，snapshot 对应字段 MUST 返回 null，记录仍可保存。

#### Scenario: 越权研究 run

- **WHEN** 用户请求另一个用户的研究 run id
- **THEN** API 返回稳定的 not-found 错误且不写入记录

#### Scenario: 不完整证据仍可记录

- **WHEN** 当前报告没有决策、没有日线或没有结构化 AI 复核
- **THEN** API 保存 action/note，snapshot 保留缺失字段为 null，不伪造推荐或价格

### Requirement: 记录读取与历史

系统 MUST 提供当前研究 run 记录读取接口，以及按当前用户和股票代码按更新时间倒序读取记录历史的接口。读取接口 MUST 只返回当前用户记录，并在持久化 JSON 损坏时返回受控错误。

#### Scenario: 首次读取

- **WHEN** 用户读取没有记录的研究 run
- **THEN** API 返回成功包络且 `data=null`

#### Scenario: 股票决策历史

- **WHEN** 用户读取自己股票的决策历史
- **THEN** API 返回不超过请求上限的记录列表，包含每次 action 和对应快照时间，不返回其他用户记录

### Requirement: Quant 页面记录和复盘

Quant 研究详情 MUST 在简化推荐附近提供可访问的决策记录区域，支持四种 action、备注、保存中/成功/错误状态；页面 MUST 展示当前记录的快照摘要和最近历史。保存后页面 MUST 保留确定性推荐、AI 复核和价格区间原有展示，不触发新的 AI 请求或重新生成报告。

#### Scenario: 移动端记录决策

- **WHEN** 用户在 390px 宽度查看研究详情并打开决策记录
- **THEN** action 控件、备注、保存按钮和历史列表不发生横向溢出
- **AND** 每个控件都有可识别标签、键盘 focus 状态和错误/成功状态

#### Scenario: 记录保存失败

- **WHEN** API 返回验证、权限或网络错误
- **THEN** 页面保留用户已输入内容，显示错误并允许重试，当前研究报告不被清空
