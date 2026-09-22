## 1. 规格与 API

- [x] 1.1 建立 proposal、spec、design，明确用户隔离、批次、租约、冷却和证据边界。
- [x] 1.2 增加 scheduled run 历史查询与手动运行 route、OpenAPI 文档和用户作用域实现。

## 2. 运行时与存储

- [x] 2.1 增加历史查询 store，并让 tick 支持限定 userId 的手动执行。
- [ ] 2.2 补充 cooldown、lease、无 due item、用户隔离和每批 3 项测试。

## 3. Quant UI

- [x] 3.1 增加客户端 API 解析和手动运行状态。
- [x] 3.2 Overview 展示历史摘要、运行按钮和错误状态，不引入交易结论。

## 4. 验证

- [x] 4.1 定向测试、type-check 和 OpenSpec strict。
- [ ] 4.2 Gateway 认证态、匿名态和 D1 readback 验收。
