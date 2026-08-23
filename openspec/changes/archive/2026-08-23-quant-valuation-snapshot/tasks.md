## 1. Eastmoney valuation provider

- [x] 1.1 增加估值快照类型、Eastmoney quote 请求、字段标准化和错误映射；完成 provider 单测。
- [x] 1.2 覆盖 SH、SZ、BJ 代码映射、nullable 字段、空主体、错误响应和超时测试。

## 2. API contract

- [x] 2.1 增加估值响应 schema 和 `GET /api/quant/valuation/:tsCode` 路由。
- [x] 2.2 增加 route 认证、成功、上游失败回归测试，并完成 API type-check。

## 3. Selection UI

- [x] 3.1 扩展 Quant client/types，按选中股票加载估值快照并隔离估值错误。
- [x] 3.2 增加面向小白的估值速览、观察时间和横向比较提示，完成桌面/移动响应式样式。

## 4. Verification

- [x] 4.1 通过 Quant/API 测试、lint、type-check、build、OpenSpec strict validation。
- [x] 4.2 通过 Gateway `/quant/` 浏览器 smoke，确认种子代码、估值数据和移动布局可见且无横向溢出。
