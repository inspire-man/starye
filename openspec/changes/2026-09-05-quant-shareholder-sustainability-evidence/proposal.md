## Why

Quant 已经可以读取现金流、资本开支、分红覆盖、支付率、利息支出、有息负债、股本事件和回购计划，但当前现金流区域主要展示最新报告期。单一报告期适合做即时核对，无法支撑对股东回报现金流连续性的观察。

## What Changes

- 复用现有 Eastmoney 现金流报告序列，按报告期生成最多 8 期的现金流证据历史。
- 每期保留经营现金流、资本开支、自由现金流、同报告期分红、利息支出、有息负债、利息后自由现金流和年度支付率等原始或衍生值。
- 在现有 `cashflowEvidence` 中增加历史序列和覆盖统计，最新报告期字段继续保持原有含义。
- 研究报告增加一条可选的多期现金流证据摘要，让历史研究记录能识别报告期数量、覆盖期数和字段缺口。
- Quant 详情页展示多期现金流、利息后现金流和分红覆盖的可读历史，并区分数据覆盖统计与投资判断。
- 历史 payload 缺少新增字段时由 client 归一化为空历史，既有详情和研究报告继续可读。

## Capabilities

### New Capabilities

- `quant-shareholder-sustainability-evidence`：提供多报告期的股东回报现金流连续性证据和覆盖统计。

### Modified Capabilities

- 现有股东回报接口、研究报告和详情组件增加向后兼容的历史字段。

## Non-Goals

- 不新增 D1 表或改变现有现金流 provider 的请求边界。
- 不把历史覆盖统计转成价值质量分、因子信号、研究动作、推荐或买卖判断。
- 不用相邻报告期插值、零值或最近值填充缺失字段，也不把季度值直接相加为年度值。

## Impact

- API：`shareholder-return.ts`、研究报告、响应 schema 及 Quant 定向测试。
- Quant：market parser、view model、股东回报详情和组件测试。
- Contract：扩展现有 `/api/quant/shareholder-returns` response shape，保留历史 payload 读取能力。
- 风险：报表字段可能按报告期缺失；辅助利润表/资产负债表失败必须继续局部可见；历史报告需避免把当前最新数据覆盖旧记录。

## Verification

- 覆盖完整、部分缺失、辅助来源失败和空历史四类 domain/API/parser fixture。
- 通过 Quant/API 定向测试、type-check、build、OpenSpec strict、GitNexus 变更分析。
- 经 Gateway 验证 `/quant/` 页面、研究详情和 390px 布局，确认新增历史区域无横向溢出且浏览器无 error/warn。
