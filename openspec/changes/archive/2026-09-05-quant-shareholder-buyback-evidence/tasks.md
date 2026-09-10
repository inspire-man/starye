## 1. Provider

- [x] 1.1 增加 Eastmoney 回购 provider、独立 origin 配置和规范化类型；完成标准：请求参数、股票代码、日期、金额、空值、去重和错误映射均有测试。

## 2. Domain and API

- [x] 2.1 扩展股东回报 domain，四路 provider 并行读取并隔离失败；完成标准：已实施金额求和、计划区间、状态、缺口和局部失败均有测试。
- [x] 2.2 扩展 response schema、market/research handler 和 integration contract；完成标准：新嵌套区域、旧结果兼容、认证、用户隔离和研究 optional evidence 通过测试。

## 3. Quant client and UI

- [x] 3.1 扩展 parser、view model 和股东回报详情；完成标准：camelCase/snake_case、null、计划/已实施金额区分、状态和窄屏布局通过测试。
- [x] 3.2 更新投资知识目录；完成标准：`buybackAmount` 标记 available，评分、推荐和决策回归通过。

## 4. Verification

- [x] 4.1 完成定向测试、Quant/API type-check、build、OpenSpec strict、GitNexus detect_changes 和 Gateway 验收；完成标准：真实 Eastmoney 回购记录、匿名边界、认证详情、来源状态和 390px 无溢出均有记录。
