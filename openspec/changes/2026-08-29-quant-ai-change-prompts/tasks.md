## 1. Prompt and component bridge

- [x] 1.1 新增研究变化解释核对项提示纯函数，覆盖 trim、空值、长值和 500 字符固定后缀边界。
- [x] 1.2 为变化解释核对项增加同级快捷按钮、可访问属性和 question readiness prop。
- [x] 1.3 将研究问答 readiness 命名统一，并在 `App.vue` 增加变化解释到问答的事件桥接。
- [x] 1.4 增加桌面与 390px 下的核对文本/按钮布局和 disabled 样式，确认无横向溢出。

## 2. Tests and verification

- [x] 2.1 补充纯函数和变化解释组件测试，覆盖可访问按钮、空值、长值、disabled、输入更新、焦点和手动提交边界。
- [x] 2.2 运行 Quant 测试、type-check、lint、build、OpenSpec strict 和 Gateway/browser 回归，记录无自动 AI 请求与窄屏布局结果。

## 3. Delivery

- [ ] 3.1 提交前运行 GitNexus `detect_changes`，确认只影响本 change 与 Quant 目标文件。
- [ ] 3.2 提交、推送、创建 PR；Actions 通过后合并主分支并清理本地/远端分支。
