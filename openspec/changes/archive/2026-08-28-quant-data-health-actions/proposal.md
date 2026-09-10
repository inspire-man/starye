## Why

数据健康摘要已经能准确说明日线、价值质量和股东回报的当前状态，但缺口发生时用户仍需要自行寻找观察池或候选研究入口。状态提示如果没有下一步入口，会把可靠性信息停留在只读摘要层。

## What Changes

- 为每个非完整、非读取中的数据域提供明确的前端下钻目标。
- 日线缺口进入观察池，价值质量和股东回报缺口进入候选研究。
- 复用现有 Quant 视图 hash 和已加载数据，不增加 API 请求、D1 写入或新的状态来源。
- 保留完整、读取中状态的只读语义，避免把导航动作误解为数据已修复。

## Non-Goals

- 不新增 API、D1 表、provider、自动重试或后台任务。
- 不在摘要中直接触发同步、研究生成或数据写入。
- 不修改数据健康状态计算、候选排序、信号分或研究判断。

## Impact

- `apps/quant-app/src/lib/data-health.ts`：为数据域摘要增加固定的下钻目标和文案。
- `apps/quant-app/src/lib/__test__/data-health.test.ts`：覆盖状态与动作目标的一致性。
- `apps/quant-app/src/App.vue`：渲染可访问的下钻按钮并复用现有视图导航。
- `apps/quant-app/src/style.css`：增加操作按钮的紧凑、换行和焦点样式。

## Verification

- 数据健康项处于部分可用、待补数据或读取失败时，页面显示对应下钻按钮。
- 完整或读取中状态不显示下钻按钮。
- 通过 `http://localhost:8080/quant/#overview` 点击动作后只改变 Quant 视图，不产生额外 API 请求；桌面和 390px 下无 console error/warn 或横向溢出。
