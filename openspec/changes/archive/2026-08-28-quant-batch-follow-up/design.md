## Context

See `proposal.md` for the motivation. 当前批次状态由 `comparisonResearchStates` 按 `tsCode` 保存；单股票详情由 `selectStock` 设置选中代码、打开 `DetailDrawer` 并并行加载日线、估值、财务和研究历史。批次返回的 `QuantResearchRun` 只作为本次反馈，不应替代详情的历史 readback。

## Goals / Non-Goals

**Goals:**

- 复用现有单股票研究 API 和详情打开流程。
- 让单项重试只改变目标代码的状态，并沿用现有的 pending/running/success/error 语义。
- 为操作按钮提供明确的 disabled、focus-visible、错误和窄屏状态。

**Non-Goals:**

- 不抽取新的 API client 层，不引入全局状态管理。
- 不让批次操作自动修改观察池、研究标记或当前候选筛选。

## Decisions

### 1. 复用单项 runner

新增 `retryBatchResearchItem(item)`，内部直接调用 `quantApi.generateResearchRun(item.tsCode)`，并更新同一 `comparisonResearchStates` map。这样失败重试和批量请求共享服务端契约，不需要复制批量接口。

### 2. 详情重新读回

成功项的“查看详情”调用现有 `selectStock(item)`，先关闭候选对比抽屉，再由详情流程调用 `getResearchRuns`。批次暂存的 run 不直接写入 `researchRuns`，避免历史顺序和 AI 摘要状态与服务端不一致。

### 3. 操作按状态显示

成功项显示查看详情；失败项显示单项重试；排队和运行中的项不显示可重复操作。单项重试时只禁用该行重试按钮，整批按钮仍按现有批次运行状态控制。

### 4. 保持稳定行布局

批次行采用固定的操作列最小宽度和 `flex-wrap` 窄屏规则，长股票名称、错误信息和按钮不会改变其他行的尺寸。按钮使用现有文本按钮样式与 Lucide 图标，并补充可读的 `aria-label`。

## Risks / Trade-offs

- [详情请求与单项重试并发] -> 两条流程都服务于同一股票但各自读取服务端结果；详情流程使用 request id 丢弃过期响应，重试结果只留在批次 map。
- [失败错误信息过长] -> 继续使用既有 `parsedError`，展示摘要并让容器允许换行，不把原始异常序列化到界面。

## Migration Plan

只部署 Quant Pages 静态资源。回滚时移除批次操作区和单项重试函数；已生成的研究运行仍由现有历史接口保留。
