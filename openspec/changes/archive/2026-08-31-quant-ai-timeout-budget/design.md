## 设计概览

新增 `apps/api/src/domain/quant/ai-timeout.ts` 作为完整 AI 生成器的统一预算入口，集中定义 5 分钟默认值、10 分钟上限和解析规则。六类 AI 生成器以及决策助手调用同一 resolver，避免各文件继续维护不同的 20/30 秒常量。

## API 中间件

保留普通 API 的 30 秒保护，只在 `POST` 且路径明确属于完整 AI 生成的请求上绕过该中间件：

- `/api/quant/decision-assistant`
- `/api/quant/research/runs/:runId/summary`
- `/api/quant/research/runs/:runId/question`
- `/api/quant/research/runs/:runId/change-explanation`
- `/api/quant/research/comparison`
- `/api/quant/candidates/ai-briefing`
- `/api/quant/candidates/ai-briefing/question`

`/api/quant/ai-config/test` 使用独立连接测试预算，不绕过普通超时。

## 配置和完整性

`QUANT_AI_GENERATION_TIMEOUT_MS` 作为 Worker 环境可选变量，路由只把解析后的预算传给完整生成器。前端 `requestJson` 和 Gateway `proxy` 当前没有更短的 AbortController 或代理超时，因此保留现有链路。每个生成器仍在完整响应 JSON、字段和 evidence 校验结束后才返回；决策助手沿用确定性降级与快照持久化。

## 验证

补充 resolver 边界测试、API 超时绕过路径测试和长 AI 生成器的预算调用测试；运行 API/Quant 全量测试、类型检查、lint、构建、OpenSpec strict，并经 Gateway 页面复核。
