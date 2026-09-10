# 提案：导出与复制历史 AI 候选会话

## 背景与目标

历史 AI 会话现在可以只读查看，也可以把仍存在于当前候选快照的引用跳转到详情，但复核记录仍停留在页面内。用户需要保存历史简报、快照范围和追问回答时，仍要手工整理页面内容。

本 change 的目标是让选中的历史会话能够一次性导出或复制为 Markdown，保留足够的快照元数据、历史候选代码、简报内容和追问内容，方便离线复核与记录。

## What Changes

- 在历史会话详情中增加导出 Markdown 和复制 Markdown 操作。
- 新增历史会话 Markdown 序列化函数，使用 allowlist 输出会话元数据、候选代码、简报和追问。
- 复用现有剪贴板结果语义，区分复制成功、浏览器不支持和写入失败，并提供可见状态。
- 导出文件名包含历史快照日期和稳定会话标识，避免同日会话互相覆盖。

## 非目标

- 不新增 API、D1 字段或 provider 请求。
- 不导出 API key、token 或未列入会话类型的内部字段。
- 不修改当前简报导出格式、当前候选排序、历史会话内容或只读边界。

## Capabilities

### New Capabilities

- `quant-ai-history-export`：覆盖历史候选 AI 会话的 Markdown 导出、复制和错误状态。

### Modified Capabilities

- 无。

## Impact

- 代码：`apps/quant-app/src/components/QuantAiCandidateBriefing.vue`、`apps/quant-app/src/lib/candidate-briefing-export.ts` 及对应测试。
- 运行时：只使用浏览器 Blob、下载链接和剪贴板 API，不产生服务端副作用。
- 风险：历史 session 的嵌套数据需要稳定序列化；移动端操作区和长文本需要保持可换行。

## 验收要求

历史详情 MUST 能在存在或不存在浏览器剪贴板能力时给出明确结果；导出的 Markdown MUST 只包含 allowlist 字段，并包含历史会话的快照范围和已保存内容。
