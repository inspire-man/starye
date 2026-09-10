# 设计

## 事件协议

新增 `POST /api/quant/research/runs/:runId/summary/stream`，响应类型为 `text/event-stream; charset=utf-8`，并带有 `Cache-Control: no-store`。每个事件使用标准 SSE `event` 与 JSON `data` 字段：

- `started`：包含研究运行 ID、实际响应模式和生成预算。
- `delta`：包含本次收到的文本片段和累计字符数。片段只用于进度展示。
- `completed`：包含经过现有 `parseQuantAiSummary`、因子影响计算和 D1 写入后的完整摘要视图。
- `error`：包含现有 Quant 错误码、消息和详情；失败结果不产生摘要写入。

## 服务端流程

路由完成用户、研究运行和 AI 配置校验后立即返回 `ReadableStream`。stream 模式下，`generateQuantAiSummary` 将 transport 的文本增量回调到路由；JSON 模式没有增量事件，但仍发送 `started` 和最终 `completed`。完成事件只在 `createQuantResearchSummary` 成功后发送。

路由内部捕获异步生成错误并编码为 `error` 事件，因为流已经建立后无法再用普通 JSON error response 改写状态码。客户端断开时关闭队列并取消上游请求，服务端不保存半截结果。

## 客户端流程

Quant API client 使用 `ReadableStreamDefaultReader` 和 SSE 帧解析器，解析事件 JSON，向回调报告 `started`/`delta`，并对 `completed.data` 复用现有摘要解析器。`error` 事件转换为 `QuantApiError`，保持现有重试和配置错误 UI。

摘要组件显示实际响应模式与累计接收字数；增量文本不直接作为结论渲染，最终内容仍只来自已校验并持久化的摘要。

## 兼容与边界

既有 `POST .../summary` JSON 路径保持不变，自动化批处理继续使用该路径。Gateway `/api` 已经 bypass 缓存并透传响应 body，因此本接口不需要新增代理规则。事件字段使用 snake/camel 兼容读取策略时，以本接口 camelCase 契约为准。
