## Why

Quant 当前经营驱动因子仍把合同负债、应收账款和存货列为缺口，导致用户看到“部分可用”时缺少同报告期的原始经营上下文。Eastmoney 资产负债表接口和 AkShare 资产负债表端点已经返回这些字段，适合沿用现有来源回退链补齐可追溯证据。

## What Changes

- 在财务报告快照中以元为单位暴露可选的合同负债、应收账款和存货字段，并保留报告期、代码和 provider provenance。
- Eastmoney 财务 provider 补读同报告期资产负债表；AkShare bridge 从现有资产负债表来源归一化并按报告期合并。
- 研究报告增加三项 optional operating-driver evidence；缺失、非有限值、代码不匹配和来源异常继续保持为显式缺口或安全错误。
- Quant 基本面详情展示经营驱动原始字段和报告期，知识目录更新“已接/待接”字段状态。
- 不引入 D1 migration，不推导订单、销量、价格或利润，不修改价值质量评分、候选信号、推荐和决策判断。

## Capabilities

### New Capabilities

- `quant-working-capital-evidence`: 同报告期资产负债表经营驱动字段、来源回退、研究证据和展示边界。

### Modified Capabilities

- 无。现有评分和判断需求保持不变；本 change 只增加独立的可选证据。

## Impact

- 影响 `apps/api/src/domain/quant/provider.ts`、AkShare bridge normalizer/adapter、Quant API schema/parser、研究报告 builder、知识目录和 Quant 基本面组件。
- 影响财务 provider 的请求次数与测试 fixture；新增的辅助来源异常不得掩盖已有财务报告。
- 不改变路由路径、认证范围、D1 schema 或现有报告版本兼容形状。
