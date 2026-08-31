# 设计

## API 与查询

- 新增 `GET /api/quant/research/decisions?limit=20`，使用现有认证中间件和 `QuantDecisionRecordQuerySchema`。
- repository 只按当前用户读取 `quant_decision_record`，按 `updated_at DESC, id DESC` 排序后按 `ts_code` 保留第一条，再应用最多 20 条的队列上限。
- 路由放在 `/research/decisions/:tsCode` 之前，返回现有 `decisionRecordView` 的数组结构；客户端不提交任何快照字段。
- 读取异常沿用 Quant 受控错误包络，前端把队列错误作为局部状态，不清空候选快照。

## 前端状态与计算

- `App.vue` 在工作台加载和刷新时读取队列，队列请求失败只影响队列区域。
- 新增纯函数把服务端记录、候选快照和最新交易日组合为展示项：记录价与当前候选收盘价均为有限正数且日期不同才计算百分比；同日显示“等待新日线”，缺少候选或价格显示对应状态。
- 队列默认展示最近 6 条，动作和报告推荐使用已有枚举文案；点击条目调用现有 `selectStock`，不复制详情加载逻辑。
- 组件提供加载、错误、空状态和长备注换行样式，队列表面不使用表格横向扩展。

## 验证

- API 集成测试验证空队列、同股票多 run 去重、更新时间排序、limit 上限和用户隔离。
- Quant 单元测试验证同日保护、非有限价格、候选缺失和动作/推荐文案；组件测试验证加载、错误保留和点击详情。
- 运行 Quant/API type-check、定向测试、build、lint、OpenSpec strict，并经 `http://localhost:8080/quant/#candidates` 验证桌面与 390px 页面无页面级横向溢出。
