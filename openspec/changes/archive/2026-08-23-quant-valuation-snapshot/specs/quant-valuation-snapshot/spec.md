## ADDED Requirements

### Requirement: 估值快照接口

系统 MUST 提供受现有 Quant 管理员认证保护的 `GET /api/quant/valuation/:tsCode` 接口，返回选中 A 股的标准化估值快照。接口 MUST 不要求浏览器携带上游 token。

#### 场景：读取有效股票

- **WHEN** 已认证用户请求合法的 SH、SZ 或 BJ 股票代码
- **THEN** API 返回 `tsCode`、`observedAt`、`dynamicPe`、`peTtm`、`peStatic`、`pb`、`ps`、`peg` 和 `marketCap` 字段

#### 场景：字段缺失

- **WHEN** Eastmoney 响应缺少某个可选估值字段或字段为空
- **THEN** 对应标准化字段返回 `null`，不得用 0、上一只股票的数据或猜测值填充

#### 场景：上游响应异常

- **WHEN** Eastmoney 返回非成功 HTTP、坏 JSON、错误 `rc` 或缺少主体 `data`
- **THEN** API 返回结构化 Quant provider 错误，不返回部分猜测快照

#### 场景：未认证访问

- **WHEN** 未通过现有 Quant 管理员认证的请求访问接口
- **THEN** 请求沿用现有 Quant 路由认证行为并被拒绝

### Requirement: 估值速览工作台

Quant 择股工作台 MUST 在选中观察池股票时展示估值速览；估值请求失败 MUST 只影响估值区域，不得清空已加载的日线、观察池或择股信号。

#### 场景：展示估值速览

- **WHEN** 选中股票的估值快照加载成功
- **THEN** 页面展示估值指标、观察时间和“仅作横向比较”的口径提示

#### 场景：估值不可用

- **WHEN** 估值接口失败或字段全部为空
- **THEN** 页面显示可理解的暂无数据状态，并保留其他择股数据

#### 场景：移动端展示

- **WHEN** 页面宽度为 390px
- **THEN** 估值速览内容堆叠显示，文本不被截断，页面不产生横向溢出

### Requirement: 数据边界

估值快照 MUST 保持为按需读取的即时数据，不得写入现有 `quant_daily_bar`；工作台 MUST 不展示 provider、积分或能力注册表诊断信息。

#### 场景：读取不改变日线存储

- **WHEN** 用户打开或刷新选中股票的估值速览
- **THEN** 系统只读取估值接口，不新增或修改 `quant_daily_bar` 记录，工作台仍保持择股数据边界
