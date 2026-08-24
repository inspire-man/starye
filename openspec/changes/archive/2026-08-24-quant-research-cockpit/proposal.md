## Why

当前工作台已经能解释技术信号，但用户仍需要打开多只股票详情、手工记录研究结论，才能回答“为什么关注、哪只更值得先看、我上次看到哪里”。这会把择股流程拆散在页面和记忆中，降低日常复盘效率。

本轮将工作台从“信号展示”推进为“研究决策入口”，让技术信号、20 日表现、估值和财务质量可以在同一条研究路径中比较，并把用户自己的研究状态持久化。

## What Changes

- 在分析抽屉顶部增加候选决策卡，集中展示入选依据、命中规则、20 日表现、数据完整度和需要核对的项目。
- 在候选表支持最多选择 3 只股票，并以对比抽屉展示技术、估值和财务质量的横向数据。
- 新增每只观察池股票的研究状态和备注，支持“待研究、重点关注、暂缓、已排除”四种状态。
- 新增 Quant 研究标记 API 和 D1 表，状态更新采用单股票幂等读回。
- 研究状态不参与信号评分、预设筛选或收益推断；上游数据缺失继续以缺失状态展示。

## Capabilities

### New Capabilities

- `quant-research-cockpit`: 候选决策卡、三股对比和研究标记的用户工作流。

### Modified Capabilities

- `openspec/specs/quant-api/`: 增加研究标记读取与更新接口契约。
- `openspec/specs/quant-data/`: 增加研究标记的独立持久化和唯一性约束。

## Impact

- API：`apps/api/src/routes/quant/`、`apps/api/src/domain/quant/`、Quant schema 与测试。
- DB：新增 Quant 研究标记 migration，不修改日线和候选快照结构。
- Frontend：`apps/quant-app/src/App.vue`、API client、类型和样式。
- Shared UI：复用现有 `DataTable`、`DetailDrawer`，不改变其公共交互契约。
- 风险：对比请求最多并发读取 3 只股票的估值和财务数据；上游失败必须按股票隔离显示，不能阻塞技术指标对比。

## Non-goals

- 本轮不实现回测、胜率预测、自动交易或组合收益归因。
- 本轮不把研究状态当作买入、卖出或风险评级。
- 本轮不新增用户可见的数据源 token 或修改既有同步 provider。
