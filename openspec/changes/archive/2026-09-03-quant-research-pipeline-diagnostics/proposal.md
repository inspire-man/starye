## Why

自动研究闭环已经能按项保留确定性报告并支持重试，但真实 AI 上游失败时页面只显示“AI 复核失败”，用户无法区分失败阶段或定位可重复的错误类型。现在补充安全、可审计的错误码展示，直接改善当前闭环的排障和重试体验。

## What Changes

- 从自动研究项保存的异常中提取有限格式的错误码。
- 在失败项中显示失败阶段和错误码；没有结构化错误码时继续显示通用失败状态。
- 保留已生成的确定性报告、AI 失败语义和现有重试入口。
- 禁止把原始异常文本、URL、请求体或凭据渲染到页面。

## Capabilities

### New Capabilities

- `quant-research-pipeline-diagnostics`: 为自动研究闭环提供安全的阶段和错误码诊断展示。

### Modified Capabilities

无。现有自动研究执行顺序、API、D1 持久化和确定性推荐保持不变。

## Impact

- `apps/quant-app/src/lib/research-automation.ts`：增加错误码提取纯函数。
- `apps/quant-app/src/components/QuantResearchAutomation.vue`：展示失败阶段和安全错误码。
- 自动研究 helper/component 测试及 390px UI 验收。
- 不新增 API、D1 表、provider 或依赖。

系统 MUST 在错误对象包含结构化错误码时展示该错误码，并在缺少错误码时保留通用失败状态；已保存报告 MUST 继续可查看和重试。
