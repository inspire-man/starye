# 设计

## 数据模型

新增 `quant_ai_run_audit` 表，每次摘要生成尝试写入一条终态记录：

- `operation` 固定为 `research-summary`，为后续问答、对比和候选简报扩展保留边界。
- `status` 为 `completed`、`failed` 或 `cancelled`。
- 保存 provider、model、response mode、generation timeout、received chars、duration、started/completed time。
- 成功时保存 `summary_id`；失败时保存受限的 Quant error code 和可读错误原因。
- 不保存 prompt、响应正文、API key 或上游原始错误 body。

审计记录按用户和研究运行建立索引，保留最近 30 条/运行，历史读取最多返回 10 条。

## 服务端流程

摘要生成入口在调用 AI 前记录 `startedAt` 和配置快照，在 transport 增量回调中只累计字符数。成功时先保存已校验摘要，再写入 completed 审计；失败时写入 failed/cancelled 审计并重新抛出原有 QuantError。审计写入使用独立 best-effort 操作，审计自身失败记录日志，不改变确定性报告边界。

成功摘要响应增加 `audit` 当前运行视图；历史摘要读取保持现有结构，同时新增 `GET /research/runs/:runId/ai-audits?limit=` 返回审计列表。流式 `completed` 事件与 JSON 摘要响应都携带相同审计视图。

## 客户端与界面

Quant client 解析审计状态并提供读取方法。研究详情加载摘要后并行加载审计历史；摘要面板显示最近一次运行状态、响应模式、耗时、接收字数、预算和“已保存摘要/失败原因”。半截或失败尝试只出现在运行记录，不进入推荐结论。

## 边界

已有摘要没有对应审计时页面显示“历史运行信息不可用”，不会推断成功或失败。用户隔离条件同时应用于研究运行和审计记录；跨用户 runId 返回 404。审计只作为信任证据，不改写因子权重、确定性分数、推荐或价格区间。
