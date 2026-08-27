## Why

候选对比抽屉已经能把 2 至 3 只股票放在同一张表里，但进入研究仍需要逐只打开详情并手动生成报告。批量研究可以把比较结果直接推进到可复核的研究快照，减少重复操作，同时保留每只股票独立的证据状态。

## What Changes

- 在候选对比抽屉增加批量生成研究报告入口，范围限定为当前已选择的 2 至 3 只候选。
- 复用现有单股票研究运行 API，以有界并发逐只生成报告，并在界面显示排队、进行中、完成和失败状态。
- 某一股票生成失败时保留其他股票的结果，并提供明确的批次汇总；不把失败项伪装成成功。
- 保持现有研究报告、评分、研究动作、API contract 和 D1 schema 不变。

## Capabilities

### New Capabilities

- `quant-batch-research`: 从候选对比上下文批量创建独立研究快照，并呈现逐项进度与结果。

### Modified Capabilities

## Impact

- `apps/quant-app/src/App.vue`：增加批量研究状态、触发入口和结果面板。
- `apps/quant-app/src/lib/research-batch.ts`：新增有界并发、稳定结果顺序和进度回调的纯 TypeScript 编排器。
- `apps/quant-app/src/style.css`：增加批量研究面板的状态和窄屏布局。
- `apps/quant-app/src/lib/__test__/research-batch.test.ts`：覆盖并发上限、顺序、成功与部分失败。
- 不新增 API、数据库迁移、provider 或外部依赖。

## Risks

- 多个上游请求同时执行可能增加瞬时负载；批量编排限制为最多 3 项且并发不超过 2。
- 用户可能在失败后误以为整批成功；逐项状态与批次完成/失败计数始终可见。
