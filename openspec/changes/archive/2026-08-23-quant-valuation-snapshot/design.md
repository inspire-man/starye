## 数据 provider

- 在现有 `apps/api/src/domain/quant/provider.ts` 增加估值快照和 quote provider 类型，复用已有的 SH/SZ/BJ `secid` 映射与 Eastmoney 请求错误边界。
- 使用 `push2.eastmoney.com/api/qt/stock/get`，请求 `f162` 至 `f168`、`f116` 等已验证字段。
- 标准化字段为 `dynamicPe`、`peTtm`、`peStatic`、`pb`、`ps`、`peg`、`marketCap` 和 `observedAt`。空字段保留为 `null`，不以 0 替代。
- provider 每次按股票读取，不持久化到 D1；后续做历史分位时另建专用估值快照模型。

## API 契约

- 在 `apps/api/src/schemas/quant.ts` 定义估值响应 schema。
- 在现有受保护 `quantRoutes` 增加 `GET /valuation/:tsCode`，由服务端创建 Eastmoney quote provider 并把上游异常映射为 `QuantError`。
- 复用现有 `apps/quant-app/src/lib/api-client.ts` 的 JSON 请求和错误解析边界，不在 Vue 组件内直接请求上游。

## 工作台交互

- 选中观察池股票或候选后，并行加载日线与估值快照；重新选择股票时替换两者。
- 估值区域显示指标名称、当前值、观察时间和简短口径；响应失败只影响估值区域，不覆盖日线与信号。
- 估值区域以一组紧凑的数据行呈现，保持 Dashboard/Quant 的 token、密度和移动端堆叠规则。
- 文案使用“横向比较”“数据截至”等状态语言，不显示 provider、积分或能力注册表。

## 验证

- provider 单测覆盖 secid、字段标准化、null 字段、异常响应和超时。
- route 单测覆盖成功响应、认证边界和上游失败映射。
- client 单测覆盖字段兼容读取和 null 保留。
- 运行 Quant type-check、lint、test、build、OpenSpec strict，并经 Gateway 浏览器检查估值区域在桌面与 390px 移动宽度下无溢出。
