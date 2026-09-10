## 1. API client

- [x] 1.1 复用 `SyncResult` 解析现有 `/sync` GET 响应；完成标准：completed、partial、rejected 和 `data: null` 的边界明确。
- [x] 1.2 增加 API client 单测；完成标准：字段归一化、空状态和 credentials 请求契约通过。

## 2. Quant 页面

- [x] 2.1 在工作台加载时恢复持久化同步状态；完成标准：重载后显示最近状态、完成时间和计数，手动 POST 结果优先。
- [x] 2.2 增加同步状态加载、无记录和失败状态；完成标准：失败不伪装成无记录，观察池和候选数据不受影响。
- [x] 2.3 补充响应式状态样式；完成标准：长错误信息可换行，桌面与 390px 不产生横向溢出。

## 3. 验证

- [x] 3.1 运行 Quant 定向测试、type-check、lint 和 build；完成标准：受影响检查通过。
- [x] 3.2 运行 OpenSpec 严格验证和 GitNexus 变更检测；完成标准：只报告预期 Quant 文件和流程。
- [x] 3.3 通过 Gateway 复核持久化 completed、空态和读取失败路径；完成标准：页面实际状态与 API 一致且无 console error/warn。
