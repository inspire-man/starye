## Why

AI 研究变化解释会列出两次报告之间最值得核对的下一步事项，但这些事项目前仍只能阅读。用户需要把同一核对语义重新输入报告问答框，变化解释到核验之间存在重复操作。

## What Changes

- 为研究变化解释的下一步核对项提供有界的报告问答模板。
- 在每个核对项旁增加同级、可访问的“带入追问”按钮。
- 复用现有研究问答输入桥接，填充并聚焦 textarea，不自动提交或请求 AI。
- 增加空值、长度边界、禁用状态、可访问性和 390px 布局测试。

## Capabilities

### New Capabilities

- `quant-ai-change-follow-up`: 从 AI 研究变化解释核对项带入报告问答。

### Modified Capabilities

- 无。

## Impact

- 影响 `apps/quant-app` 的变化解释组件、`App.vue`、提示模板和组件测试。
- 复用已合并的 `QuantAiResearchQuestion` 聚焦桥接，不新增 API、D1 数据、provider 或网络请求。
- 需要通过 Quant 全量验证、OpenSpec strict 以及 Gateway/browser 桌面与 390px 回归。
