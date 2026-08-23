## Why

当前 Quant 工作台只展示最近一份财务报告，用户看得到“现在是多少”，看不出经营质量是在改善还是变差；观察池也只有估值横向比较，缺少基本面质量的同池参照。Eastmoney 已一次返回多期报告，现阶段可以在不增加数据库和定时任务的前提下把这些信息转成易懂的趋势提示。

## What Changes

- 增加最近 4 期财务质量读取接口，保留报告期、公告日期和现有数值字段。
- 增加观察池财务质量比较接口，提供营收同比、净利润同比、ROE 和资产负债率的同池相对位置。
- 工作台在基本面速览下增加“最近几期趋势”和“观察池质量位置”，缺失值继续显示为暂无数据。
- 增加 provider、API route、client parser、UI stale-request 和移动布局测试。

非目标：不新增数据库表、不缓存或写入财务报告、不改变现有单期 `/financial/:tsCode` 接口语义、不把趋势位置解释成买卖建议。

## Capabilities

### New Capabilities

- `quant-financial-trend`：描述财务历史报告、趋势提示和观察池质量比较。

### Modified Capabilities

- 无。

## Impact

- 影响 `apps/api` Quant provider、schema 和路由，`apps/quant-app` 类型、API client 和工作台展示。
- 继续复用 Eastmoney 公开财务接口和现有超时、认证、错误映射；不需要新增 secret 或 migration。
- 主要风险是历史报告顺序、空值语义、部分观察池上游失败和快速切换股票时的旧请求覆盖，均通过回归测试约束。

