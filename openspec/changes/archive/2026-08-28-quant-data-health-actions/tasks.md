## 1. Data-health action model

- [x] 1.1 为数据健康项增加固定的下钻目标和文案；完成标准：日线、价值质量、股东回报的部分/待补/失败状态目标稳定，完整/读取中无动作。
- [x] 1.2 增加动作目标与状态组合单测；完成标准：动作不改变现有计数和状态语义。

## 2. Quant overview

- [x] 2.1 在数据健康项渲染下钻按钮并复用现有 Quant 视图导航；完成标准：点击只切换视图，不触发额外请求或写入。
- [x] 2.2 增加可访问、响应式焦点与换行样式；完成标准：按钮有 accessible name，390px 无横向溢出。

## 3. Verification

- [x] 3.1 运行 Quant 测试、type-check、lint 和 build；完成标准：受影响检查通过。
- [x] 3.2 运行 OpenSpec 严格验证和 GitNexus staged 变更检测；完成标准：只报告预期 Quant 文件和流程。
- [x] 3.3 通过 Gateway 验证完整、部分、失败、读取中和点击下钻状态；完成标准：页面状态、hash、请求数量和 console 结果一致。
