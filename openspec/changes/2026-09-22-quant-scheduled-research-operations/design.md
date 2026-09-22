# 设计

## API 与运行时

- 在 `scheduled-research-store` 增加历史查询，沿用 `jobFromRow` 和 `scheduledResearchView`，避免复制序列化逻辑。
- 在 `runQuantScheduledResearchTick` 增加可选 userId 过滤；定时入口保持全用户行为，手动入口只传当前 session 用户。
- 在 research handler 增加 `GET /research/schedule/history` 与 `POST /research/schedule/run`。
- 手动入口直接等待有界 tick 完成，返回 `jobId`、`processedCount` 和 `skippedReason`；不暴露内部错误文本。

## Quant 客户端与 UI

- 扩展 research resource 的 DTO 解析和方法。
- Overview 增加历史摘要和立即运行按钮，保持现有 `scheduledResearch` props 不变，新增可选 props/事件。
- App.vue 负责调用 API、刷新 schedule/history，并处理加载与错误状态。

## 验证

- API route/domain/store 定向测试。
- Quant resource 和 Overview 组件测试。
- type-check、OpenSpec strict；若本地服务可用，再走 Gateway 认证路径。

