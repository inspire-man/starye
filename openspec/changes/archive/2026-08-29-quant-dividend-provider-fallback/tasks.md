## 1. Provider contract

- [x] 1.1 扩展 Quant 分红 provider 结果契约，增加 Eastmoney `RPT_SHAREBONUS_DET` provider，并完成代码匹配、状态、日期和每股金额校验；完成标准：provider 单测覆盖实施、预案、错误代码、无效数值、超时和每十股到每股转换。
- [x] 1.2 增加 provider chain 组合器，按主源失败原因尝试一次回退并返回实际来源元数据；完成标准：Tushare 成功、Tushare quota 回退、无 token 直用 Eastmoney、两源失败和并发请求均有单测。

## 2. Shareholder return and report

- [x] 2.1 更新股东回报领域服务的单项/批量结果，保留缺失值边界并暴露 provider、chain、fallback reason 和最终错误；完成标准：既有股息率公式测试通过，回退结果不把失败当空记录。
- [x] 2.2 让研究报告 evidence/source 和因子来源使用实际股息 provider；完成标准：Tushare 与 Eastmoney 两种来源的报告快照均不出现错误的固定来源名称。

## 3. API and UI

- [x] 3.1 更新 Quant 路由、客户端解析和类型契约；完成标准：认证边界保持不变，API 集成测试验证 quota 回退、来源元数据、两源失败和 token 不出响应。
- [x] 3.2 在研究详情展示实际分红来源、回退状态和可读缺口；完成标准：组件/页面测试和 390px 浏览器检查无横向溢出。

## 4. Verification and delivery

- [x] 4.1 运行 Quant API/客户端/组件测试、type-check、lint、build 和 OpenSpec strict validation；完成标准：全部通过且新增字段在旧数据缺失时保持可读。
- [x] 4.2 通过 Gateway 验证 `/quant/` 与 `/api/quant/shareholder-returns`，确认研究报告和 D1 JSON 读回的 provider 元数据一致，并运行 GitNexus detect_changes；完成标准：回退链、报告证据和页面显示互相一致。
