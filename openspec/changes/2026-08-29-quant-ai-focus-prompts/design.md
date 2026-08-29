# 设计

## 组件结构

`QuantAiCandidateBriefing` 保留现有重点候选详情按钮，将每一项包在普通的 `quant-ai-briefing-focus-row` 容器内。详情按钮与新增的 `quant-ai-briefing-focus-prompt` 按钮作为同级控件渲染，避免在 button 内嵌套 button。

新增 `questionPromptForFocusItem` 格式化函数，使用候选名称和 `tsCode` 生成固定问题，并沿用 `useQuestionPrompt` 的 500 字符边界、可用性判断、输入更新和 `nextTick` 聚焦逻辑。快捷按钮只调用该函数和 `useQuestionPrompt`，不调用 `submitQuestion` 或 `askQuestion`。

## 状态与布局

- 当前存在可追问候选且没有追问加载时，快捷按钮可用。
- 候选快照不可用、AI 配置不可用或追问进行中时，快捷按钮保持 disabled。
- 桌面端使用主详情按钮加紧凑的同级操作列；移动端切换为单列，快捷按钮放在详情按钮下方，避免候选名称、代码和操作互相挤压。
- 保留详情按钮现有的 `focusCandidate` 行为和可见内容，不改变 AI 简报字段。

## 验证

组件测试检查：

1. 重点候选快捷按钮填入包含名称和代码的问题、聚焦当前 textarea，且未发出 `askQuestion`。
2. 详情按钮仍然独立触发 `focusCandidate`，重点候选行内不存在嵌套按钮。
3. 加载中、不可用状态下快捷按钮 disabled。
4. 现有简报、下一步核对、历史追问和响应式包装测试保持通过。
