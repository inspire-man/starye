---
quick: 260817-kys-dashboard
date: 2026-08-17
status: complete
---

# Dashboard 二次确认弹窗与确认操作交互优化

## Delivered

- 重构 `packages/ui/src/components/ConfirmDialog.vue`：增加 danger/default 主题语义、图标、过渡动画、Esc 关闭、焦点保存/恢复、Tab 焦点约束、body 滚动锁定、ARIA 标识、slot、预览列表、文本确认、异步 loading 和移动端按钮布局。
- 危险操作默认不因遮罩点击误关闭，所有按钮声明 `type="button"`，loading 期间确认/取消/关闭控件均防止重复提交。
- 统一 `Actors`、`Comics`、`Crawlers`、`Movies`、`Posts`、`Publishers`、`R18Whitelist` 的确认入口文案、危险语义与异步状态；成功关闭弹窗，失败保留弹窗以便重试。
- 新增 ConfirmDialog 交互回归测试，覆盖可访问性、滚动锁定、焦点循环、Esc、危险遮罩、slot、文本确认和异步 loading。

## Scope

本 quick task 仅修改共享确认组件、Dashboard 7 个调用页面、对应测试和 GSD 记录；未修改 API、数据库、爬虫执行逻辑或其他无关工作树内容。

## Residual

- Gateway 页面访问已确认返回 HTTP 200，但当前未登录会跳转 `/auth/login`；此前已有 mock session 完成了 Dashboard 爬虫/漫画确认弹窗的桌面端、390×844 移动端、Esc、按钮布局和 console 日志检查。
- GitNexus `detect_changes(scope: "all")` 汇总风险为 `high`，主要源于共享确认组件覆盖多条执行流；关键 symbol 的正式 upstream impact 均为 `LOW`，未发现额外上游调用链。
