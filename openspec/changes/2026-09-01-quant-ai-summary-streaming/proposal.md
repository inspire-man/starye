# Quant AI 摘要端到端流式响应

## Why

当前 AI transport 已经可以从中转平台读取 SSE，但服务端会等完整结果生成后才返回 JSON。用户在长耗时复核期间只能看到静态加载状态，无法判断请求是否仍在推进；半截模型输出也没有独立的传输状态。

## What Changes

- 为研究摘要提供经 Gateway 原样转发的 SSE 接口。
- 把开始、增量、完成和失败作为可观察事件交给 Quant 页面。
- 只有结构化响应校验和 D1 持久化都成功后，页面才接收最终摘要。
- 保留既有 JSON 接口，批量研究与历史读取继续使用原有契约。

## Capabilities

### New Capabilities

- `quant-ai-summary-streaming`：研究摘要的 SSE 生命周期和页面进度。

### Modified Capabilities

- `quant-ai-runtime-reliability`：复用已配置的响应模式、超时预算和错误分类。

## Impact

- 本轮不把追问、对比和候选简报迁移到流式接口。
- 本轮不把半截模型文本写入研究摘要或其他 AI 会话表。
- 本轮不改变确定性研究报告、因子分数和参考价格的计算规则。

## Risk

长连接会增加请求持续时间和浏览器取消场景。事件协议需要明确错误边界，Gateway 及页面必须保留 `no-store`，避免中间层缓存或复用用户级生成结果。
