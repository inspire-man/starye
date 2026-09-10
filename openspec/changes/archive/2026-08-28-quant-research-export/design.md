## Context

See `proposal.md` for the motivation. 详情抽屉已经持有 `QuantResearchRun` 和可选 `QuantResearchSummary`，报告数据来自服务端保存的结构化快照。当前页面没有文件下载逻辑；Quant 运行在浏览器端，因此可以使用 Web `Blob` 和临时对象 URL 完成本地导出。

## Goals / Non-Goals

**Goals:**

- 用纯函数把允许导出的研究字段转换成稳定、可测试的 Markdown。
- 通过现有报告头部的操作区触发浏览器下载，并生成可读且稳定的文件名。
- 对空数组、空值、缺失证据和可选 AI 摘要保持明确文案，不补造数据。

**Non-Goals:**

- 不把导出内容上传到服务端或第三方 provider。
- 不让导出结果成为新的研究快照或候选排序输入。

## Decisions

### 1. 纯 formatter 与下载动作分离

`buildResearchReportMarkdown` 只接受报告和可选摘要，返回字符串；`downloadResearchReport` 只负责 Blob、对象 URL 和 anchor 下载。这样格式边界可以在 Vitest 中验证，浏览器 API 只保留在 Vue 组件中。

### 2. 明确字段白名单

导出报告头部、状态摘要、支持依据、风险核对、数据缺口、下一步、证据列表、来源快照和 AI 摘要中的已知字段。不会对对象执行深层 JSON 序列化，避免意外写入 provider 配置、内部元数据或未来未审查字段。

### 3. 保持缺失语义

`null`、空数组和缺失观察时间分别输出 `暂无数据`、`暂无记录` 和 `未记录`。证据的状态、原始值、阈值、来源和公式版本保留原文，导出只是呈现，不重新计算分数。

### 4. 稳定文件命名

文件名只使用规范化后的股票代码和生成日期；非法字符替换为短横线，缺失日期使用 `unknown-date`，避免把报告标题或用户输入变成路径片段。

## Risks / Trade-offs

- [Markdown 内容较长] -> 使用固定标题和列表，保留完整证据但不复制页面样式。
- [对象 URL 生命周期] -> 点击后通过短延时释放 URL，避免下载尚未开始就撤销资源。
- [AI 摘要不可用] -> 仅当当前页面已有摘要时导出摘要分节，报告主体不受影响。

## Migration Plan

只部署 Quant Pages 静态资源。回滚时移除导出按钮和 formatter；已有下载文件与服务端研究历史互不影响。
