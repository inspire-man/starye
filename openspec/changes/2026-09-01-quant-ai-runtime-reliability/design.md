## Context

当前 AI 配置只保存 provider、model、Base URL 和加密密钥；共享 transport 固定发送 `stream: false`，所有摘要、提问、对比、候选简报和决策助手都同步等待完整响应。现有 AI 结果只有在结构化校验成功后才写入 D1，因此可以在 transport 层增加运行方式而不改变因子模型边界。

## Goals / Non-Goals

**Goals:**

- 让长响应在中转平台逐步返回内容时保持连接活跃，并支持用户明确选择 JSON 模式。
- 把用户预算、部署预算上限和 524 超时原因纳入同一套可测试契约。
- 让配置页和研究详情显示实际运行选择与确定性结论的独立性。

**Non-Goals:**

- 不引入后台队列、Durable Object 或自动交易动作。
- 不改变 AI prompt、因子权重、证据引用规则或确定性价格公式。
- 不把半截流式文本作为摘要、决策或因子复核持久化。

## Decisions

1. **复用现有用户配置表增加两列。** `response_mode` 使用 `stream` 默认值，`generation_timeout_ms` 使用 300000 默认值；保留现有加密密钥和唯一用户索引。这样 API、D1 和设置页读取同一来源，避免只在浏览器保存偏好。

2. **共享 transport 负责 SSE 与 JSON。** 所有 AI domain 已经通过 `requestQuantAiCompletion` 访问 provider，因此只在这里分派响应模式。SSE 只收集增量文本和完成原因，最终仍进入各领域的 JSON/版本/证据校验；不会为每个 AI 功能复制解析器。

3. **有效预算由用户值和部署上限共同决定。** 用户值限制在 5-10 分钟；路由继续读取 `QUANT_AI_GENERATION_TIMEOUT_MS` 作为部署上限，最终传给各生成函数的值取两者较小值。缺少历史字段时按默认值处理，测试 fixture 可继续省略可选的解密配置字段。

4. **524 归类为 timeout。** Cloudflare 524 表示等待上游响应超过边界，与本地 AbortController 超时具有相同的恢复动作；错误码沿用各 AI 功能已有 timeout code，消息附带 HTTP 524，方便用户切换模式或重试。

5. **设置页采用分段模式和固定预算选项。** 响应模式用两个互斥按钮，预算用 5 分钟/10 分钟选项，避免用户填写任意值导致难以解释的运行预算。保存后重新读取 API 返回值，连接测试使用保存的运行参数。

## Risks / Trade-offs

- [某些 provider 的 SSE 数据不含标准 choices.delta] -> 支持常见 Chat Completions 增量形状和可解析的 JSON fallback；其余情况返回受控 invalid response，用户可切换 JSON 模式。
- [流式连接仍可能长时间无数据] -> AbortController 继续执行有效预算；524 与本地 timeout 均提供明确重试语义。
- [部署上限低于用户选择] -> 服务端以部署上限为最终预算，设置页只展示保存的用户预算，不伪造已绕过平台限制。

## Migration Plan

1. 更新 Drizzle schema，生成并检查 `0048_quant_ai_runtime_reliability.sql`，迁移测试覆盖默认值、字段和旧配置回读。
2. 发布 API/Quant 兼容代码；现有配置通过 SQL 默认值获得流式模式和 5 分钟预算，旧 API 客户端忽略新增响应字段。
3. 通过 API/Quant 测试、Gateway、D1 本地 readback 和已登录浏览器验证；生产迁移由现有部署 workflow 执行。
4. 回滚代码时保留新增列，旧代码只读取已有字段；回滚运行参数时不触碰加密密钥和历史 AI 快照。
