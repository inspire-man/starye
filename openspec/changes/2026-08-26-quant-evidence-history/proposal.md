## Why

当前 Quant 能查看最近一次研究报告，也能读取同一股票的历史运行，但用户只能手动对照多次报告，难以快速判断 ROE、估值、趋势和数据缺口是在改善还是恶化。中长线研究更关心变化过程，而不是孤立的单次分数。

## What Changes

- 复用已加载的研究运行历史，比较最新报告与上一份报告的证据状态和值。
- 在研究详情抽屉增加证据变化摘要，明确标识改善、转弱、新出现、恢复、持续缺失和无明显变化。
- 展示前后数值、变化量、两次报告时间和口径提示；缺少可比较数值时只显示状态变化，不推算数值。
- 没有上一份报告时显示诚实的历史不足状态，不影响当前报告和 AI 摘要。

## Capabilities

### New Capabilities

- `quant-evidence-history`: 为单只股票提供研究快照之间的证据变化回看。

### Modified Capabilities

## Impact

- `apps/quant-app/src/lib/research-evidence-history.ts`：新增纯函数比较器和变化类型。
- `apps/quant-app/src/App.vue`：连接已有 `researchRuns`，在研究详情中展示变化摘要。
- `apps/quant-app/src/style.css`：增加紧凑、响应式的变化行样式。
- `apps/quant-app/src/lib/__test__/research-evidence-history.test.ts`：覆盖数值、状态和缺失边界。
- 不修改 API、D1、bridge、AI prompt 或历史报告格式。

## Goals / Non-Goals

**Goals:**

- 让用户在一次抽屉阅读中看到当前证据相对上次的方向变化。
- 保留每次报告的原始值、日期和状态，不把变化标签伪装成新的投资结论。
- 用易懂的改善/转弱/新增/恢复等文字降低历史对照成本。

**Non-Goals:**

- 不改变研究评分、研究动作、AI 摘要或证据阈值。
- 不使用历史变化生成买入、卖出、目标价或收益预测。
- 不把缺少上一份报告解释为“没有变化”。

## Risks

- 两次报告的证据集合可能不同；比较器按 evidence key 对齐，缺失项显式标注。
- 财务报告期或数据来源发生变化；变化行同时展示报告时间，并对不可直接比较的值保留状态提示。
- 历史运行数量不足；页面使用空状态，不阻塞当前研究报告。
