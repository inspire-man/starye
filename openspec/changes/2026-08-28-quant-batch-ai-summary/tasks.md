## 1. Batch AI summary boundary

- [x] 1.1 新增有界批量 AI 摘要编排器和状态更新纯函数；完成标准：最多 3 项、最多 2 并发、输入顺序稳定、单项失败不阻断其他项。
- [x] 1.2 增加定向测试；完成标准：覆盖 pending/running/success/error、部分失败、并发上限、重复输入和失败项单独重试。

## 2. Quant comparison workflow

- [x] 2.1 在对比抽屉增加批量 AI 摘要入口；完成标准：只对已完成批次的成功研究运行调用现有摘要 API，用户未点击时没有网络请求。
- [x] 2.2 增加逐项摘要状态、模型信息和失败重试；完成标准：重复点击被阻止，研究运行变化会丢弃旧回调，其他成功项状态保持不变。
- [x] 2.3 增加响应式/可访问样式；完成标准：按钮、状态和错误文案在桌面与 390px 可见、可聚焦且不溢出。

## 3. Verification

- [x] 3.1 运行 Quant 定向测试、type-check 和 build；完成标准：所有受影响检查通过。
- [x] 3.2 运行 OpenSpec strict、GitNexus detect_changes 和 `git diff --check`；完成标准：只报告预期 Quant 前端符号/文件。
- [x] 3.3 通过 `http://localhost:8080/quant/` 验证未点击无请求、批量成功/部分失败/重试状态和 390px 布局；完成标准：无 console error/warn，确定性导出/复制不被改变。
