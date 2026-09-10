# 设计

## 提示模板

新增 `buildComparisonAiNextCheckPrompt(check)`，对核对项去除首尾空白，使用固定前缀和后缀生成问题；名称过长时只截断核对项文本，保留固定后缀，最终长度不超过 500 字符。空核对项返回空字符串。

## 组件桥接

`QuantAiCandidateBriefing` 继续以 `useQuestionPrompt` 作为唯一的输入更新和聚焦实现，通过 `defineExpose` 暴露该方法。`App.vue` 使用一个窄类型 template ref 调用它，不直接查询或操作子组件内部 DOM。

对比结果中的快捷按钮仅在 `snapshot.generatedAt` 存在、当前筛选有可追问候选且当前追问不在加载时启用。点击时先调用子组件方法，再关闭对比抽屉；子组件通过现有 emit 更新父级问题状态并在 `nextTick` 中聚焦 textarea。

## 布局与可访问性

- 每个核对项使用普通列表项内的文本和同级按钮，不嵌套按钮。
- 按钮使用 `BrainCircuit` 图标、可见“带入追问”文本、`aria-label` 和 `title`。
- 桌面端按钮位于核对项右侧；窄屏端按钮切换到下一行并占满可用区域。
- 对比抽屉关闭后，候选简报追问框保持当前输入内容，且不自动发送请求。

## 验证

1. 纯函数测试覆盖空值、长值、固定后缀和 500 字符边界。
2. 候选简报组件测试覆盖公开方法仍复用已有填充/聚焦逻辑。
3. Quant 全量测试、type-check、lint、build、OpenSpec strict 及 Gateway 桌面/390px 回归通过。
