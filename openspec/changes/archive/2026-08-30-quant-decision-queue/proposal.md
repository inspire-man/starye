## Why

Quant 已经可以在研究详情保存决策并回看价格变化，但候选页仍然只呈现技术信号、证据覆盖和研究优先级。用户每天重新进入工作台时，需要逐个打开详情才能知道自己最近对哪些标的做过判断，决策记录的价值没有进入日常筛选流程。

## What Changes

- 增加认证用户级的最新决策队列读取接口，每只股票只返回更新时间最新的一条记录。
- 在候选研究页增加紧凑的“决策待办”区域，展示动作、报告推荐、记录价、当前价和可复核的价格变化状态。
- 支持从队列条目直接打开原有研究详情；当前候选缺失、价格缺失和同日数据分别显示明确状态。
- 保持决策记录、信号分、证据覆盖和研究优先级相互独立；本 change 不新增写入动作和数据库表。

## Capabilities

### New Capabilities

- `quant-decision-queue`: 候选页使用的用户级最新决策队列和可复核展示。

### Modified Capabilities

- 无。

## Impact

- `apps/api/src/domain/quant/repository.ts`：增加按用户去重读取最新决策记录的查询。
- `apps/api/src/routes/quant/index.ts`：增加认证只读路由，复用现有决策记录快照解析和响应结构。
- `apps/quant-app/src/lib/api-client.ts`、`quant-types.ts`、决策队列组件和 `App.vue`：加载队列并接入候选页。
- 需要覆盖用户隔离、重复研究 run 去重、同日价格保护、接口错误保留候选页和 390px 布局。
