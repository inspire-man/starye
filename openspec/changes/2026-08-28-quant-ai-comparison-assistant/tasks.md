## 1. Comparison AI contract

- [x] 1.1 新增对比 AI domain、bounded prompt 和响应校验；完成标准：版本、字段上限、股票/evidence 引用白名单、交易指令过滤和错误分类稳定。
- [x] 1.2 增加 `POST /api/quant/research/comparison` 认证路由和 schema；完成标准：当前用户 2-3 个 run 成功，缺失/跨用户/重复/数量越界在模型请求前失败。
- [x] 1.3 增加 domain/route 集成测试；完成标准：有效结果、非法引用、非法交易结论、配置缺失、上游失败和不修改研究数据均有覆盖。

## 2. Quant comparison surface

- [x] 2.1 扩展 Quant types/client 并加入对比助手请求；完成标准：响应 envelope、错误码、差异和引用字段解析有测试。
- [x] 2.2 在候选对比抽屉增加主动触发、加载/成功/失败/重试状态；完成标准：只处理已完成的 2-3 个研究 run，重复点击被阻止，原对比表和研究状态保持不变。
- [x] 2.3 展示共同点、逐股差异、风险、下一步和证据引用导航；完成标准：每条引用映射到对应股票详情，服务端历史重新读取。
- [x] 2.4 增加响应式、焦点和长文案样式；完成标准：桌面和 390px 可读、可键盘操作、无横向溢出。

## 3. Verification

- [x] 3.1 运行 API/Quant 定向测试、type-check、lint 和 build；完成标准：所有受影响检查通过。
- [x] 3.2 运行 OpenSpec strict、GitNexus detect_changes 和 `git diff --check`；完成标准：只报告预期 Quant/API 文件和流程。
- [ ] 3.3 通过 `http://localhost:8080/quant/` 验证未点击无请求、成功/失败/重试/引用导航和 390px 布局；完成标准：无 console error/warn，AI 不改变确定性数据。（当前真实用户数据仅有 1 份可用研究运行，成功/失败/重试和引用跳转仍需在具备 2-3 份运行后复核。）
