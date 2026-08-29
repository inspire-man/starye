# 任务

- [x] 1.1 增加当前核对项与历史问题的快捷提示状态、模板生成、500 字符约束和 textarea 聚焦；完成标准：快捷动作只 emit 输入更新，不触发追问提交。
- [x] 1.2 在当前简报和历史会话 UI 中增加可访问按钮与移动端换行样式；完成标准：可用、加载、无候选和快照不可用状态清晰且无嵌套控制。
- [x] 1.3 补齐组件测试，覆盖模板、历史问题原文、聚焦、截断、禁用和历史只读边界；完成标准：组件定向测试通过。
- [x] 1.4 运行 Quant 全量测试、type-check、lint、build、OpenSpec strict 验证和 Gateway 桌面/390px 浏览器验收；完成标准：无测试失败、console error 或横向溢出。
- [x] 1.5 运行 GitNexus staged change detection，检查范围后提交并推送；完成标准：只涉及预期 Quant 前端 symbols。
- [ ] 1.6 Actions 通过后合并到 `main`，验证合并提交 Actions，删除远端/本地功能分支，并从最新 `main` 开始下一步开发。
