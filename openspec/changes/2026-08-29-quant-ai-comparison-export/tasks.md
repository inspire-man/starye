# 任务

## 1. Formatter 与页面实现

- [x] 1.1 新增 AI 对比结果 Markdown formatter 和日期文件名 builder；完成标准：固定字段白名单、原始数组顺序、空列表语义和额外字段隔离明确。
- [x] 1.2 在 AI 对比成功结果中增加导出/复制操作、状态反馈和过期复制保护；完成标准：不增加 API 请求，结果切换时旧状态不回写。
- [x] 1.3 增加桌面/390px 操作区和结果反馈样式；完成标准：按钮可访问、加载/错误态不显示旧结果操作、无横向溢出。

## 2. 测试与验证

- [x] 2.1 增加 formatter 和剪贴板 payload 测试；完成标准：完整、空列表、长文本、字段白名单和复制内容一致性通过。
- [x] 2.2 运行 Quant 测试、type-check、lint、build、OpenSpec strict 与 Gateway/browser 验收；完成标准：所有相关检查通过并记录结果。

## 3. 交付

- [x] 3.1 运行 GitNexus `detect_changes` 并检查目标范围；完成标准：仅包含本 change 与 Quant 目标文件。
- [ ] 3.2 提交、推送、创建 PR，Actions 通过后合并；完成标准：合并提交 Actions 通过并清理本地/远端分支。
