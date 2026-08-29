# 任务

- [x] 1.1 抽取可复用的简报 Markdown section builder，并新增历史会话 Markdown 与文件名 builder；完成标准：当前简报导出测试不回归，历史完整/空内容/allowlist 测试通过。
- [x] 1.2 在历史详情增加导出和复制按钮，接入 Blob 下载、剪贴板三态和 request-id 竞态保护；完成标准：成功、不支持、失败和切换会话状态可见且可重试。
- [x] 1.3 保持历史内容只读、当前简报行为不变，并补齐组件无嵌套控制、长文本换行和键盘操作测试；完成标准：组件定向测试通过。
- [x] 1.4 运行 Quant 全量测试、type-check、lint、build、OpenSpec strict 验证和 Gateway 桌面/390px 浏览器验收；完成标准：无测试失败、console error 或横向溢出。
- [ ] 1.5 运行 GitNexus staged change detection，检查范围后提交并推送；完成标准：只涉及预期 Quant 前端 symbols。
- [ ] 1.6 Actions 通过后合并到 `main`，验证合并提交 Actions，删除远端/本地功能分支，并从最新 `main` 开始下一步开发。
