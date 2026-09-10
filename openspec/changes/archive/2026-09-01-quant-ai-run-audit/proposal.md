# Quant AI 运行审计

## Why

Quant 当前可以展示 AI 摘要和流式接收进度，但生成结束后用户仍难以判断这次结果是否完整、耗时是否接近预算、失败发生在哪一层，以及最终是否真的形成了可回看的摘要。失败尝试也没有持久化记录，重试时缺少可复核上下文。

## What Changes

- 新增按用户和研究运行隔离的 AI 运行审计记录。
- 对研究摘要的成功、超时、上游失败、结构化响应失败和取消进行终态记录。
- 记录响应模式、有效预算、耗时、接收字符数、错误码和是否关联已保存摘要；不保存 prompt、API key 或完整 AI 输出。
- 提供审计历史读取接口，并在研究详情显示最近运行状态和完整性提示。

## Capabilities

### New Capabilities

- `quant-ai-run-audit`：研究摘要 AI 运行诊断和可回看历史。

### Modified Capabilities

- `quant-ai-summary-streaming`：完成与失败事件补充持久化审计信息。

## Impact

涉及 `packages/db` 迁移/schema、`apps/api` Quant 仓储和路由、`apps/quant-app` 类型/client/研究摘要组件，以及数据库、API 和组件测试。用户级审计按 `user_id` 与 `research_run_id` 查询，保持现有认证边界。

## Risk

审计写入位于外部 AI 调用之后，必须避免审计失败覆盖已经生成的确定性报告或摘要；错误信息需要有长度边界，避免把上游响应或敏感内容写入 D1。历史记录新增字段也需要兼容旧摘要和旧数据库数据。
