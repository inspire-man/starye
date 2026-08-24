## 1. Comparison API

- [x] 1.1 增加估值比较类型、schema 和 `GET /api/quant/valuation/compare/:tsCode` 路由。
- [x] 1.2 实现观察池并发读取、样本统计、百分比计算和部分失败边界。
- [x] 1.3 增加 route 认证、404、成功、缺失字段和 provider 错误测试。

## 2. Selection client and UI

- [x] 2.1 扩展 Quant client/types，解析比较响应并复用目标估值快照。
- [x] 2.2 增加观察池相对位置展示、样本提示和移动端样式。

## 3. Verification

- [x] 3.1 通过 API/Quant 测试、lint、type-check、build、OpenSpec strict validation。
- [x] 3.2 通过 Gateway `/quant/` 桌面和 390px 移动端 smoke，确认比较范围和样本状态可见。
