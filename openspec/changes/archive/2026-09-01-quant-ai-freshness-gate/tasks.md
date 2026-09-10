## 1. Readiness gate

- [x] 1.1 增加数据新鲜度就绪度检查；完成标准：最新/需复核/已过期/未知分别映射为通过/复核/阻断。
- [x] 1.2 更新就绪度纯函数测试；完成标准：时效检查独立于完整性，整体状态和原因稳定。

## 2. AI recommendation gate

- [x] 2.1 将工作台新鲜度传入简化推荐；完成标准：组件收到摘要 freshness 与说明，缺省按未知处理。
- [x] 2.2 仅在最新数据时应用已接受 AI 推荐；完成标准：其他状态保留确定性推荐，AI 复核与因子审计仍可见并说明原因。
- [x] 2.3 补组件回归测试和响应式检查；完成标准：AI 接受/门控、就绪度文案和 390px 无溢出覆盖。

## 3. Verification

- [x] 3.1 运行 Quant 测试、type-check、lint 和 build；完成标准：全部通过。
- [x] 3.2 运行 OpenSpec strict 与 GitNexus staged 变更检测；完成标准：规格有效且只影响预期 Quant 流程。
- [x] 3.3 通过 Gateway 验证 fresh/aging/stale/unknown、AI 应用和移动端；完成标准：页面、请求数量和 console 结果一致。
