## ADDED Requirements

### Requirement: 决策卡提供 AI 复核入口

当研究报告存在且没有可用结构化 AI 决策复核时，决策卡 MUST 显示可访问的 AI 复核操作；操作 MUST 通过组件事件交给父组件处理。

#### Scenario: 没有 AI 摘要

- **WHEN** 研究报告存在但当前报告没有 AI 摘要
- **THEN** AI 状态行显示“尚未进行 AI 决策复核”及“让 AI 复核”操作
- **AND** 点击操作只触发 `requestAiReview` 事件

#### Scenario: 旧版摘要没有结构化复核

- **WHEN** 当前报告已有历史摘要但摘要中 `decisionReview` 为空
- **THEN** 决策卡仍显示复核操作
- **AND** 不把旧摘要误标为已影响最终推荐

### Requirement: 复核状态与重复请求

决策卡 MUST 接收父组件的 AI 复核进行中状态；进行中时操作 MUST disabled，完成后由父组件传入的摘要/错误状态更新页面。

#### Scenario: 复核进行中

- **WHEN** 父组件传入 `aiReviewGenerating=true`
- **THEN** 决策卡显示“AI 复核中”
- **AND** 复核操作不可再次点击

#### Scenario: 复核成功

- **WHEN** 父组件传入包含合法 `decisionReview` 的摘要
- **THEN** 决策卡显示 AI 推荐和“已影响最终推荐”或对应保留原因
- **AND** 价格区间仍来自报告确定性字段

#### Scenario: 复核失败

- **WHEN** 现有摘要生成流程返回配置或上游错误
- **THEN** 决策卡保留确定性推荐和复核入口
- **AND** 错误信息由既有 AI 摘要区域展示

### Requirement: 响应式与键盘可达

入口 MUST 使用现有按钮样式、可见 focus 状态和 Lucide 图标；在 390px 宽度下不得造成横向溢出。

#### Scenario: 窄屏打开决策卡

- **WHEN** 用户在 390px 宽度查看决策卡
- **THEN** AI 复核文字、状态和按钮保持在容器内
- **AND** 所有入口可通过键盘聚焦和触发
