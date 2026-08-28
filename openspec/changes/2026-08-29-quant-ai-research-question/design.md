# 设计

## API 与 domain

新增受保护接口 `POST /api/quant/research/runs/:runId/question`，请求体只有 `question` 字段，限制为 1 至 500 个字符。路由按当前认证用户读取 `runId`，重新解析服务端保存的研究报告，再读取该用户已保存的 AI 配置。前端不提交报告正文、模型或 API key。

domain 返回版本化结果 `research-question-v1`：`provider`、`model`、`generatedAt`、`question`、`answer` 和 `citedEvidenceKeys`。回答只保存在本次 HTTP 响应中，不调用研究运行或摘要写入 repository。

## Prompt 与响应校验

Prompt 只包含经过长度限制的用户问题，以及报告的版本、股票代码、名称、状态、研究动作、分数、标题、来源和 evidence 字段。模型必须返回严格 JSON，字段只允许 `answer` 与 `citedEvidenceKeys`。服务端限制回答长度和引用数量，引用 key 必须存在于当前报告；未知字段、未知引用、空字段和交易指令都返回分类错误。

## 前端状态

详情抽屉在 `latestResearchReport` 存在时显示提问区。问题提交期间按钮禁用，当前问题的回答显示加载状态；成功显示回答和引用，失败显示错误并保留重试入口。切换股票、重新读取研究历史或生成新报告时清空旧问题状态并递增 request id，过期响应不覆盖当前股票。

## Evidence 导航与响应式

引用使用可见的 evidence key 和 accessible name。点击引用滚动到当前报告对应证据行并短暂高亮，不触发额外 API 请求。输入框、按钮、回答和引用在 390px 视口允许换行，保留 `focus-visible` 和 `role="status"`/`role="alert"`。

## 错误分类

提问配置缺失、超时、上游失败和非法响应使用独立 `QUANT_AI_QUESTION_*` 错误码；报告不存在沿用 `QUANT_NOT_FOUND`，请求体边界沿用验证器错误。所有失败都不写入 D1。

## 回滚

回滚时移除提问接口、详情提问区和本地状态；既有单股 AI 摘要、对比助手、研究历史和确定性数据保持不变。
