## 1. Decision model and report

- [x] 1.1 新增版本化因子模型与决策投影纯函数，定义趋势、估值、盈利质量、股东回报、风险的来源、权重、覆盖度和推荐阈值，并用单元测试验证有限数值与缺失数据观望。
- [x] 1.2 将股息率接入报告因子聚合，生成带公式、来源、观察时间和 evidence key 的参考买入/卖出区间，并覆盖窗口不足和负/空值边界。
- [x] 1.3 扩展 `QuantResearchReport` 与报告构建测试，确认报告生成结果包含 factorModel、decision 和历史版本可读字段。

## 2. AI decision review and API

- [x] 2.1 将 AI 摘要 prompt、响应校验和版本升级为结构化 decisionReview，限制推荐枚举、置信度、证据 key 和失效条件，并禁止 AI 生成价格。
- [x] 2.2 更新研究摘要路由、持久化读回和旧版摘要解析，验证用户隔离、伪造输入拒绝和 D1 JSON 内容完整。
- [x] 2.3 更新 Quant API 类型/客户端解析与报告导出，验证缺失或旧版字段不会生成猜测推荐。

## 3. Simplified UI

- [x] 3.1 新增推荐卡组件，展示确定性推荐、AI 复核、覆盖度、买入/卖出参考区间及口径说明，并在 390px 下完成布局测试。
- [x] 3.2 将推荐卡接入单股研究详情和 AI 摘要，保留来源、权重、证据与失效条件的展开查看路径。

## 4. Verification and delivery

- [x] 4.1 运行 Quant API/客户端/组件全量测试、type-check、lint、build 和 OpenSpec strict validation。
- [x] 4.2 通过 Gateway 与本地 D1 authoritative readback 验证新旧报告、AI 复核、缺失股息率和价格区间一致性，并运行 GitNexus detect_changes。
