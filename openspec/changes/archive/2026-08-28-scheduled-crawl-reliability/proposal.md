## Why

2026-08-28 的 Daily Manga Crawl 因章节页面批量写入触发 D1 SQL 变量上限，造成多组章节同步失败。Daily Movie Crawl 在主体内容处理完成后遇到一次 runner 控制回调 5xx，事件序列从 228 跳到补偿请求 230/231，最终由 provider reconciliation 将运行标记为失败。两条定时任务都需要在下一轮运行前恢复可持续的持久化与回报能力。

## What Changes

- 将 native D1 章节页面写入拆成低于平台变量上限的固定批次，并让大章节集保持原子替换语义。
- 为 runner 控制请求增加有界的 5xx 重试；每次重试复用同一签名请求体、事件 ID、nonce 和序号，保持事件幂等性。
- 补充 native D1 批处理和 runner 5xx 恢复的回归测试，并记录定时任务验证门槛。
- 保持现有图片源降级行为、D1 schema、工作流 schedule 配置和回调响应契约。

## Capabilities

### New Capabilities

- `scheduled-crawl-reliability`: 为漫画页面同步和电影/漫画 runner 控制回调提供定时任务可靠性保证。

### Modified Capabilities

## Impact

- API：`apps/api/src/routes/admin/sync/handlers.ts` 的 native D1 页面批处理。
- Crawler：`packages/crawler/src/task-runner/runner-client.ts` 的控制请求重试。
- Tests：API sync handler、crawler runner-client 及生产 task-runner 集成覆盖。
- 生产验证：重新运行两个 GitHub Actions 定时入口，并对 D1 run/event/transition 做权威读回。
- 风险：runner 控制请求属于共享生命周期边界；重试次数与退避必须有界，4xx 语义保持原样。

系统 MUST 在生产定时爬虫遇到可恢复的控制面 5xx 时，用相同事件身份完成有界重试，并让 D1 页面写入在平台变量限制内完成。
