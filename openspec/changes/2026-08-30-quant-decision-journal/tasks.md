# 任务

## 1. 规格与数据层

- [x] 1.1 建立 proposal、spec、design，冻结 action、服务端快照和用户隔离边界。
- [x] 1.2 增加 `quant_decision_record` schema、0046 migration、relations 和 migration test，验证唯一约束、索引、级联删除和 nullable snapshot 字段。

## 2. API 与持久化

- [x] 2.1 增加决策记录 action/snapshot 类型、repository upsert/read/list 和受控 JSON 解析。
- [x] 2.2 增加 Valibot 请求/响应契约和认证路由，验证首次读取、保存、更新、越权、历史上限和坏数据错误。
- [x] 2.3 在 API 集成测试中验证 snapshot 只来自服务端 run、最新日线和已保存摘要，并完成 D1 authoritative readback。

## 3. Quant 页面

- [x] 3.1 扩展 Quant 类型、API client 和解析器，覆盖 `data=null`、历史数组和 snapshot 兼容。
- [x] 3.2 增加决策记录组件和 App 状态桥接，覆盖四种 action、保存/错误状态、选股切换竞态和键盘可达。
- [x] 3.3 在研究详情展示当前记录快照与历史，不改变原有推荐、AI 复核和价格区间。

## 4. 验收与交付

- [x] 4.1 运行 DB/API/Quant 定向测试、type-check、build、lint 和 OpenSpec strict。
- [ ] 4.2 通过 Gateway 验证研究详情和 390px 页面，运行 staged GitNexus detect_changes，完成提交。
