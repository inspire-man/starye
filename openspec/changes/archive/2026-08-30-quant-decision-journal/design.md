# 设计

## 数据模型

新增 `quant_decision_record`：

- `id`、`user_id`、`research_run_id`、`ts_code`、`action`、`note`、`snapshot_json`、`created_at`、`updated_at`。
- `user_id` 和 `research_run_id` 非空并级联删除；`(user_id, research_run_id)` 唯一，`(user_id, ts_code, updated_at)` 建索引。
- snapshot JSON 只由服务端构造，使用 `decision-record-v1` 版本，包含报告确定性字段、最新日线、最新 AI 决策复核的最小字段和 `factorModel.configuration`。

## API 与 repository

- `GET /api/quant/research/runs/:runId/decision` 返回当前用户当前 run 的记录或 `null`。
- `PUT /api/quant/research/runs/:runId/decision` 只接收 `{ action, note }`，先通过用户范围读取 run，再读取最新日线和摘要，使用 upsert + D1 readback。
- `GET /api/quant/research/decisions/:tsCode?limit=10` 返回当前用户该股票的最近记录。
- repository 对 id、用户、run 和 action 做边界校验；路由对报告 JSON、摘要 JSON 和 snapshot JSON 使用受控解析错误。

## 前端

新增 `QuantDecisionJournal.vue`，作为决策卡下方的独立密集 surface：

- 使用四项 radio/segmented action、备注 textarea、保存按钮。
- 当前记录显示 action、更新时间、快照中的价格/日期、报告推荐/覆盖度和 AI 复核状态。
- 历史列表只展示最近记录，空状态、加载、保存、错误均可见；不在组件内直接访问 API，由 `App.vue` 管理请求竞态和选股切换。
- 保存成功后刷新当前记录和历史；不改变报告或 AI 状态。

## 验证

迁移测试验证表、唯一用户/run、级联删除和索引；API 集成测试验证服务端快照、越权、upsert、历史和损坏 JSON；组件测试验证四种 action、保存状态、失败保留输入和 390px 布局。运行 Quant 全量测试、API/DB type-check、build、lint、OpenSpec strict，并通过 `http://localhost:8080/quant` 检查实际页面。
