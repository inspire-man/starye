## 背景

Quant 对比抽屉已经支持将成功生成的批量研究报告下载为 Markdown 文件，但用户在聊天、工单或研究笔记中复核多个标的时仍需要先下载再打开文件。批量导出 formatter 已经生成了完整的报告集合，增加一个本地复制出口可以缩短复核路径。

## 目标

- 在本批次研究全部结束且至少有一份成功报告时提供复制 Markdown 操作。
- 复制内容复用现有批量 Markdown formatter，保留成功报告顺序和失败项目摘要。
- 对剪贴板不支持、权限拒绝和写入失败显示诚实状态，失败后允许重试。

## 非目标

- 不新增 API、D1 表、服务端分享链接或权限模型。
- 不自动重新生成报告，不发起网络请求，不改变候选选择、对比数据或研究历史。
- 不实现富文本、HTML、PDF 或跨设备同步。

## Capabilities

### New Capabilities

- `quant-batch-report-copy`：为批量研究结果提供本地 Markdown 剪贴板复制和可访问的状态反馈。

### Modified Capabilities

- 无。

## 影响

- `apps/quant-app/src/App.vue`：增加批量复制状态、操作和结果提示。
- `apps/quant-app/src/style.css`：增加复制按钮状态与窄屏布局样式。
- `apps/quant-app/src/lib/research-report-copy.ts`：复用现有可注入剪贴板写入边界，不改变其 API。
- `apps/quant-app/src/lib/__test__/research-batch-export.test.ts`：补充复制 payload 的 formatter 覆盖。

## 风险

- 浏览器剪贴板权限由运行环境决定，页面只能根据 Promise 结果报告状态。
- 批量报告内容可能较长，复制仍使用当前页面已加载的 Markdown，不引入额外数据读取。
