## Context

单股报告页面已经由 `App.vue` 同时渲染 `QuantAiResearchSummary` 和 `QuantAiResearchQuestion`。候选简报组件已有 `defineExpose`、template ref 和 `nextTick` 聚焦模式，本 change 复用该边界，不让摘要组件直接操作兄弟组件或 DOM。

## Goals / Non-Goals

**Goals:**

- 让摘要核对项生成稳定、有界、报告范围明确的问题。
- 复用研究问答组件的输入更新和聚焦能力。
- 保持按钮可访问、可禁用且适配窄屏。

**Non-Goals:**

- 不改变研究问答 API、AI prompt、持久化模型或报告内容。
- 不在快捷动作中自动提交问题或生成新的 AI 结果。

## Decisions

- **由纯函数负责模板边界。** 新增摘要专用提示函数，先 trim 核对项，再在固定前缀和后缀之间截断，确保后缀始终保留。这样边界行为可独立测试，也避免在 Vue 模板中拼接长文本。
- **由问答组件负责填充和聚焦。** `QuantAiResearchQuestion` 公开 `useQuestionPrompt`，通过现有 `update:input` emit 更新父状态，并在 `nextTick` 后聚焦自身 textarea。`App.vue` 只持有窄类型 ref 并转发摘要事件，避免跨组件查询 DOM。
- **摘要组件负责可用性呈现。** `questionPromptReady` 作为布尔 prop 传入；摘要按钮与核对项同级，点击只发出已生成的问题。按钮 disabled 时不发出事件。
- **桌面/窄屏分层布局。** 桌面端使用文本和按钮两列，390px 以下切换单列并让按钮独占下一行；长文本使用 `overflow-wrap: anywhere`，避免影响父布局。

## Risks / Trade-offs

- [风险] 填充新问题后旧回答仍可能暂时显示 → 保持与现有候选简报桥接一致，由用户主动提交后才刷新回答；不引入额外状态清理。
- [风险] 摘要按钮渲染时问答 ref 还未建立 → `App.vue` 事件处理同时检查 `questionPromptReady` 和 ref，缺失时静默保持原摘要状态。
- [风险] 生成中的报告会暂时隐藏问答组件 → 通过 `questionPromptReady` 禁用快捷按钮，避免产生不可见的输入更新。

## Migration Plan

无需数据迁移。发布后直接使用现有单股报告页面；回滚只需移除摘要快捷按钮和 ref 桥接代码，不影响已保存报告与问答接口。
