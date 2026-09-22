# 设计

## API

- 在决策 repository 增加用户作用域的全历史读取，服务端限制最多 100 条。
- 在 decision handler 增加 `GET /research/decisions/calibration`，复用现有 presenter 和 query schema。
- 扩展 contracts、response schema 和 Quant resource parser。

## 前端

- 新增 `decision-calibration.ts`，按股票分组调用既有 `buildDecisionOutcome`，将后续观察按状态聚合。
- 新增 `QuantDecisionCalibration.vue`，放在候选页 AI 信任总览之后；只展示事实、样本和边界。
- App.vue 加载校准历史并传给 CandidatesView；加载失败显示可见错误，不阻断候选列表。

## 验证

- API repository/route/contract matrix 测试。
- calibration domain 与 Vue 组件测试。
- API/Quant type-check、OpenSpec strict、Gateway 匿名 401 与认证态历史读取。
