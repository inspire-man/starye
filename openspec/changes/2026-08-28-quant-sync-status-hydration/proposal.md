## Why

Quant 的同步结果已经写入 `quant_sync_state`，并通过 `GET /api/quant/sync` 返回最近一次同步的状态、范围和计数。但前端只保留本次页面会话中的 POST 结果，用户刷新或重新打开工作台后，已完成的数据会被显示为“尚未更新日线数据”，造成持久化状态与可见状态不一致。

## What Changes

- 工作台加载时读取现有同步状态，并在更新数据卡片中恢复最近一次结果。
- 区分同步状态读取中、没有历史记录、读取失败和已完成/部分完成/已拒绝。
- 手动同步完成后继续立即显示本次结果，不额外发起重复同步。
- 保持现有 API route、D1 表、同步流程和 `SyncResult` 类型不变。

## Non-Goals

- 不新增 API route、D1 表、provider、后台任务或同步重试策略。
- 不修改日线写入、候选计算、数据源配额和同步租约语义。
- 不把同步状态读取失败伪装成没有同步记录。

## Impact

- `apps/quant-app/src/lib/api-client.ts`：增加现有 `/sync` GET 响应的空值解析和读取方法。
- `apps/quant-app/src/App.vue`：恢复持久化状态并呈现加载、空态和错误态。
- `apps/quant-app/src/style.css`：补充同步状态错误和完成时间的窄屏可读样式。
- `apps/quant-app/src/lib/__test__/api-client.test.ts`：覆盖 completed 和空状态解析。

## Risks

- GET 读取与页面加载的其他请求并行，必须保留独立错误状态，避免覆盖 watchlist/candidates 的真实错误。
- 手动同步返回与持久化读取同时完成时，当前会话返回优先，避免旧 GET 结果覆盖刚完成的操作。

## Verification

- Quant 工作台 MUST 在重载后以现有 `/api/quant/sync` 的最近状态显示同步结果；当接口返回 `null` 时 MUST 显示无历史记录；读取失败时 MUST 显示可重试的诚实失败状态，不得显示“尚未更新”。
