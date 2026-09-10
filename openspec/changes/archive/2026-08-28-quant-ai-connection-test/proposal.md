## Why

Quant 的 AI 配置可以保存并以脱敏状态展示，但用户只有在生成完整研究摘要时才知道模型 endpoint 是否可用。直接用完整报告做首次验证会产生不必要的远端请求，也会把连接问题和报告生成问题混在一起。

## What Changes

- 新增认证的 `POST /api/quant/ai-config/test`，读取当前用户已保存的 AI 配置并向配置的 OpenAI 兼容 chat completions endpoint 发送最小探测请求。
- 返回 provider、model、耗时和测试时间，不返回 API key，不创建研究报告或 AI 摘要记录。
- 在 Quant AI 配置抽屉增加“测试连接”操作，显示成功、配置缺失、超时、上游失败和响应格式错误状态，并允许重试。
- 测试只针对已保存配置；页面加载和保存不会自动调用远端模型。

## Non-Goals

- 不改变研究报告或 AI 摘要的 prompt、校验、持久化和引用语义。
- 不保存连接测试历史，不新增 D1 表或 provider。
- 不把 API key、完整请求体或上游响应写入日志或返回给浏览器。

## Impact

- `apps/api/src/domain/quant/ai-connection.ts`：新增有界 AI endpoint 探测与错误分类。
- `apps/api/src/domain/quant/ai-summary.ts`：复用现有 chat completions URL 解析边界。
- `apps/api/src/routes/quant/index.ts`：增加认证测试路由。
- `apps/api/src/routes/quant/__tests__/crud.integration.test.ts`、`apps/api/src/domain/quant/__tests__/ai-connection.test.ts`：覆盖成功、缺 key、超时、上游和响应格式状态。
- `apps/api/src/schemas/quant.ts`、`apps/quant-app/src/lib/api-client.ts`、`apps/quant-app/src/lib/quant-types.ts`：增加响应契约和解析。
- `apps/quant-app/src/components/QuantAiSettingsDrawer.vue`：增加已保存配置测试操作和状态反馈。

## Verification

- 本地默认不触发远端测试；通过 fake fetch 验证 route/domain/client 契约。
- 通过 `http://localhost:8080/quant/` 验证保存配置后的测试按钮、状态和错误恢复；不自动发送研究内容。
