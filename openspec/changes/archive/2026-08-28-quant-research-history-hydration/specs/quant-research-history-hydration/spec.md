# quant-research-history-hydration Specification

## Purpose

让候选对比工作流能够可靠地恢复已持久化的研究结果，同时把历史读取和当前批量生成的状态边界清楚呈现给用户。

## ADDED Requirements

### Requirement: Restore research history in candidate comparison

Quant 对比抽屉 MUST 在打开时为当前选中的每只候选读取现有研究历史，并使用最新研究运行恢复该候选的研究状态。恢复的成功状态 MUST 可以继续查看详情、参与已有批量 Markdown 导出和复制；没有历史的候选 MUST 保持未开始，不得自动生成报告。

#### Scenario: Candidate has an existing research run

- **WHEN** 选中的候选存在已保存研究运行
- **THEN** 对比抽屉将该候选显示为已完成并使用最新报告的状态与研究动作
- **AND** 用户可以查看详情
- **AND** 页面不发起新的研究生成请求

#### Scenario: Candidate has no research history

- **WHEN** 选中的候选没有已保存研究运行
- **THEN** 该候选保持未开始状态
- **AND** 用户仍可以通过批量研究入口生成新报告

### Requirement: Preserve current batch state over history hydration

历史读取 MUST 不覆盖当前页面内已经排队、进行中、成功或失败的批量研究状态。历史读取结果只可以填充没有当前批量状态的候选，或更新此前由历史读取填充的状态。

#### Scenario: Batch generation races with history loading

- **WHEN** 历史读取返回时某候选已经由当前批量操作标记为排队、进行中、成功或失败
- **THEN** 页面保留当前批量状态和对应操作
- **AND** 历史响应不改变批量进度、错误原因或报告对象

### Requirement: Report history read failures independently

历史读取失败 MUST 在对应候选行单独显示可理解的失败状态，并提供只重试该候选历史读取的操作。历史读取失败 MUST NOT 清除已有可用的当前批量状态，也 MUST NOT 标记其他候选失败。

#### Scenario: Retry a failed history read

- **WHEN** 某候选的历史读取失败且用户点击重试
- **THEN** 页面只重新请求该候选的研究历史
- **AND** 失败状态在请求期间显示读取中，成功后恢复最新历史状态
- **AND** 该操作不发起研究生成请求

### Requirement: Keep restored state usable on narrow screens

历史读取中的状态文本和单项重试操作 MUST 使用现有 Quant 研究结果行的可访问名称、可见焦点和稳定布局；在 390px 视口中不得产生横向溢出。

#### Scenario: Render restored rows on a narrow viewport

- **WHEN** 对比抽屉在 390px 视口显示历史成功、无历史和读取失败候选
- **THEN** 行状态与重试操作可以换行
- **AND** 结果列表和操作区不被遮挡
