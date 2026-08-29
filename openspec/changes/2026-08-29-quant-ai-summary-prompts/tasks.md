## 1. Prompt and component bridge

- [x] 1.1 新增单股摘要核对项提示纯函数，覆盖 trim、空值、长值和 500 字符固定后缀边界。
- [x] 1.2 为研究问答组件公开填充/聚焦方法，并为摘要核对项增加同级快捷按钮与可用性 prop。
- [x] 1.3 在 `App.vue` 增加研究问答 template ref 和摘要事件桥接，确认只填充/聚焦、不自动提交。
- [x] 1.4 增加桌面与 390px 下的核对文本/按钮布局和 disabled 样式，确认无横向溢出。

## 2. Tests and verification

- [x] 2.1 补充纯函数、摘要组件和问答组件测试，覆盖可访问按钮、空值、长值、disabled、输入更新、焦点和手动提交边界。
- [x] 2.2 运行 Quant 测试、type-check、lint、build、OpenSpec strict 和 Gateway/browser 回归，记录无自动 AI 请求与窄屏布局结果。

## 3. Delivery

- [x] 3.1 提交前运行 GitNexus `detect_changes`，确认只影响本 change 与 Quant 目标文件。
- [ ] 3.2 提交、推送、创建 PR；Actions 通过后合并主分支并清理本地/远端分支。
