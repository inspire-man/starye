## Why

当前 Quant 工作台已经能维护观察池、同步日线并生成动量候选，但观察池为空时没有起始样本，页面视觉也没有充分复用 Dashboard 的运营型设计语言。仅显示一张候选表不足以支持日常择股判断。

## What Changes

- 以 D1 migration 幂等加入紫金矿业、特变电工、中国海油三只 A 股观察标的。
- 将 Quant 日线 provider 抽象为 Tushare 与 Eastmoney 两个实现；在未配置 Tushare token 时使用免费 Eastmoney 日线源，也支持通过环境变量显式选择 provider。
- 在观察池返回最新收盘价、涨跌幅，并在前端增加候选筛选、信号解释和数据源状态。
- 按 Dashboard 既有 token、表格、状态徽标、间距和响应式规则调整 Quant 视觉层。

## Impact

- API：Quant provider、同步流程、能力状态、观察池统计。
- DB：新增幂等 seed migration，不改变现有表结构。
- Frontend：Quant App 的布局、观察池、候选快照和状态展示。
- 运维：新增可选 `QUANT_DATA_PROVIDER` 与 Eastmoney origin 配置；不新增用户端 token。

## Out Of Scope

- 本轮不把 Eastmoney 的实时行情、估值和财务数据伪装成已验证能力。
- 本轮不实现回测、组合收益归因和自动交易。
