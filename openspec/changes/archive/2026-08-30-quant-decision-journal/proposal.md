# Quant 决策记录与复盘

## Why

Quant 当前可以给出看多、看空或观望、参考价格和信任检查，但用户的“我当时依据什么做了什么判断”没有持久化入口。研究报告历史记录的是系统快照变化，不等于用户决策；增加一份独立记录后，后续才能把推荐、当时价格和数据证据与实际行动分开复盘。

## What Changes

- 增加用户级 `quant_decision_record` 表，每份研究 run 最多一条当前决策记录。
- 提供读取当前 run 记录、保存/更新记录和按股票读取记录历史的认证 API。
- 保存时由服务端读取用户所属研究报告、最新日线、最新 AI 决策复核和报告内因子配置，生成不可由客户端伪造的快照。
- Quant 决策区域提供“继续观察 / 计划买入 / 已持有 / 已卖出”选择、备注、保存状态和历史记录。

## Capabilities

### New Capabilities

- `quant-decision-journal`: 用户决策记录、服务端证据快照、用户隔离和 Quant 页面复盘展示。

### Modified Capabilities

- 无。

## Impact

- `packages/db/src/schema.ts` 与 `packages/db/drizzle/0046_quant_decision_record.sql`：新增 D1 表、唯一约束和索引。
- `apps/api/src/domain/quant/repository.ts`、`apps/api/src/routes/quant/index.ts`、`apps/api/src/schemas/quant.ts`：新增 repository、认证路由和输入契约。
- `apps/quant-app/src/lib/quant-types.ts`、`api-client.ts`、`App.vue` 与决策记录组件：接入 API、表单和历史展示。
- 风险集中在用户范围校验、快照来源一致性、历史报告兼容和窄屏表单状态。

## 可验证约束

API MUST 只接受 action 和可选 note，决策快照 MUST 从服务端权威研究 run、日线和摘要数据构造；重复保存同一用户/研究 run MUST 更新同一记录，并从 D1 读回后返回。
