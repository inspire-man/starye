## 设计

1. **纯函数边界**：`buildQuantDataHealth` 接收现有 `WatchlistItem`、`SyncResult`、`QuantValueSelection` 和 `QuantShareholderReturnSelection` 以及各自加载/错误状态，输出固定版本的摘要和三条数据域记录。
2. **日线状态**：覆盖数量沿用观察池既有口径；同步 completed 且覆盖完整时为完整，partial、拒绝、无同步记录或覆盖不足时保留部分/失败/待补语义。
3. **研究数据状态**：价值质量和股东回报使用 API 已返回的 ready/partial/insufficient 计数；读取中、失败和空结果分别独立展示。
4. **UI 边界**：总览增加一个无嵌套卡片堆叠的数据健康 section；状态标签使用现有 Quant token，数据域行在窄屏下单列换行。

## 验证

- 纯函数单测验证状态优先级、计数归一化和缺失语义。
- Quant 全量 tests、type-check、lint、build、OpenSpec strict validation。
- 通过 `http://localhost:8080/quant/` 检查总览实际文案、网络请求数量、console 和 390px CDP 视口。
