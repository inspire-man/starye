## Why

当前股东回报只依赖 Tushare `dividend`。在默认 120 积分档位或 Tushare 配额、网络、权限异常时，股息率整批降为 `partial`，用户看不到可用的公开分红数据，也无法区分“主源失败后已回退”和“所有来源都失败”。这会让已经接入决策因子的股东回报证据长期缺失。

## What Changes

- 增加 Eastmoney 公开分红 provider，读取已实施分配记录并规范化为 Quant 分红契约。
- 为股东回报建立按配置顺序执行的 Tushare/Eastmoney provider 链；主源失败时按错误类别尝试回退源。
- 在批量和单股股东回报结果中返回实际命中的来源、provider 链、是否回退、回退原因和最终错误类别。
- 让研究报告和因子模型使用实际股息来源描述，保留“数据缺失不等于零值”的决策边界。
- 在 Quant 工作台展示分红来源与回退状态，便于判断数据可靠性。

## Capabilities

### New Capabilities

- `quant-dividend-provider-fallback`: 覆盖股息 provider、回退链、来源元数据和股东回报展示契约。

### Modified Capabilities

- `quant-api`: 扩展股东回报接口的 provider 状态字段，并保持现有认证与错误边界。

## Impact

- API：`apps/api/src/domain/quant/provider.ts`、`shareholder-return.ts`、`research-report.ts`、`decision-recommendation.ts` 和 Quant 路由。
- 前端：Quant 类型、API client、研究详情抽屉与分红状态展示。
- 测试：provider、股东回报、研究报告、路由集成和客户端解析测试。
- 数据库：不新增表、不新增 migration；分红仍按需读取，现有本地日线仍是股息率分母。
- 风险：Eastmoney 字段语义或响应结构变化；所有字段必须经过代码匹配、状态过滤、日期和数值校验，失败时保持缺失状态。
