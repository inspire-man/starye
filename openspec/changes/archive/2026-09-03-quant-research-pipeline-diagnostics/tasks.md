## 1. 安全错误码纯函数

- [x] 1.1 增加未知错误到安全错误码的归一化函数；完成标准：只接受有限长度且字符集受限的非空 code。
- [x] 1.2 补 helper 测试；完成标准：覆盖合法 code、空值、错误类型、超长值和危险字符，并保持执行结果不变。

## 2. 闭环失败展示

- [x] 2.1 在自动研究项失败状态展示失败阶段和安全错误码；完成标准：AI 失败保留报告查看/重试，研究失败不伪造报告。
- [x] 2.2 补组件测试和响应式样式；完成标准：无错误码回退清晰，390px 长诊断无横向溢出。

## 3. Verification

- [x] 3.1 运行 Quant 全量测试、type-check、build 和 lint；完成标准：全部通过；55 个测试文件、287 项测试通过，type-check、build 和目标文件 lint 通过。
- [x] 3.2 运行 OpenSpec strict 与 GitNexus detect_changes；完成标准：规格有效且只影响预期 Quant 自动研究流程；strict 通过，GitNexus 仅识别自动研究状态/组件范围，风险 LOW。
- [x] 3.3 通过 `http://localhost:8080/quant/#candidates` 验证真实失败诊断、报告回看、重试入口和 390px 页面；完成标准：无浏览器 error/warn 或横向溢出；真实 AI 失败显示 `QUANT_AI_SUMMARY_UPSTREAM`，390px 页面通过。
