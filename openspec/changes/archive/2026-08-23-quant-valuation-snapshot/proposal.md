## Why

当前择股工作台只有日线动量信号，能够回答“最近走势是否强”，但不能帮助初学者快速判断“当前估值大致处于什么位置”。公开的 Eastmoney 行情接口已经稳定返回一组估值字段，适合做按选中股票读取的轻量摘要。

## What Changes

- 为选中的观察池股票提供动态 PE、TTM PE、静态 PE、PB、PS、PEG 和总市值快照。
- 通过服务端请求公开行情接口，不向浏览器暴露上游地址以外的敏感配置，也不要求用户 token。
- 用清晰的“暂无数据、观察时间、仅供比较”状态辅助金融小白理解，不把估值指标包装成买卖结论。
- 保持能力注册表、积分和 provider 诊断留在数据源/运管侧，择股工作台只呈现股票数据。

## Out Of Scope

- 不把估值快照写入 `quant_daily_bar`，本轮不新增 D1 表或迁移。
- 不接入未经验证的财务报表字段、盈利预测、实时交易和自动选股结论。
- 不实现估值历史分位、行业估值比较或回测；这些需要稳定的历史数据契约后再做。

## Impact

- API：新增受保护的 `GET /api/quant/valuation/:tsCode` 只读接口和 Eastmoney quote provider。
- Frontend：选中股票区域增加估值速览和字段状态。
- 测试：增加 provider、route、client 解析和 Quant 构建验证。

## Risks

- 上游字段可能缺失或返回异常：字段按 nullable 处理，响应结构异常时 fail-closed，并在页面显示数据不可用。
- 估值数字可能被误读为买卖建议：界面明确展示观察时间和横向比较提示，不提供单一指标结论。

## Requirement Summary

Quant 估值接口 MUST 只返回经过 schema 校验的标准化字段；任何无效或缺失主体数据的上游响应 MUST 转换为可识别的 Quant provider 错误，且不得返回猜测值。
