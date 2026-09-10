# 设计：Quant AI 追问快捷提示

## 组件状态

`QuantAiCandidateBriefing` 增加一个 textarea template ref，并新增 `canUseQuestionPrompt` computed：当前候选快照可用、存在可追问候选且没有正在进行的追问时，快捷按钮可用。

`useQuestionPrompt(prompt)` 做以下事情：

1. trim 输入并限制为 500 个字符。
2. emit 现有 `update:questionInput` 事件。
3. 在下一个 DOM tick 聚焦追问 textarea。

该函数不调用 `askQuestion`，因此不会绕过用户提交动作。

## 提示来源

- 当前简报的下一步核对项通过固定模板转换为 `围绕“{核对项}”，当前候选范围内有哪些确定性事实需要优先核对？`。
- 历史追问直接使用保存的 `question` 原文，保留用户当时的问题语义。

模板只处理文本，不把候选事实或历史内容重新组合进请求；实际范围仍由父级追问流程从当前快照计算。

## 交互与响应式

- 当前核对项每行显示文本和一个原生按钮；按钮使用现有 icon/text 控件样式、`type="button"`、title 和 aria-label。
- 历史问题在问题内容旁显示“再次追问”，不会改变历史答案或引用。
- textarea、快捷按钮和长文本使用现有 wrap hook；在 390px 下按钮换行到独立网格列。
- 追问加载、无候选或快照不可用时快捷按钮禁用，保持与 textarea 同一可用性边界。

## 验证

- 组件测试覆盖当前核对项模板、历史问题原文、自动聚焦、500 字符截断、禁用状态和不自动触发 `askQuestion`。
- 运行 Quant 全量测试、type-check、lint、build、OpenSpec strict 验证及 Gateway 桌面/390px 检查。
