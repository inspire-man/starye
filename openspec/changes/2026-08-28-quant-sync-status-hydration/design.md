## 设计

1. **API client 边界**：复用现有 `SyncResult` 字段解析，增加 `parseSyncState` 对 `{ data: null }` 返回 `null`；`quantApi.getSyncState()` 只执行现有 `/api/quant/sync` GET。
2. **页面状态边界**：`syncState` 保存最近一次持久化结果，`syncResult` 保存当前会话 POST 结果；展示层优先使用 `syncResult`，工作台刷新前清除当前会话结果后再读取 GET。
3. **诚实状态**：增加独立的 `syncStateError` 和 `loading.syncState`，按读取中、失败、无记录、已知同步结果四种状态渲染。失败不复用无记录空态。
4. **刷新流程**：`loadWorkspace` 并行读取同步状态；`syncDaily` 在收到 POST 返回后同步更新本地持久化状态，再刷新已有相关数据模块，不增加第二次同步 POST。

## 验证

- API client 单测覆盖 completed snake_case 字段和 `data: null`。
- 通过 Gateway 重载 `http://localhost:8080/quant/`，确认持久化 completed 状态可见，且 Network 中没有额外 POST `/api/quant/sync`。
- 浏览器检查同步卡片的加载/完成/空态文案、console error/warn 和 390px 横向溢出。
