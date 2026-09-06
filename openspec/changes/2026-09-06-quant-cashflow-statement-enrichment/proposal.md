## Why

Quant 现金流区域已经能读取经营现金流和资本开支，但部分股票仍因利息支出、有息负债分项或来源端点异常而显示“部分可用”。AkShare 利润表和资产负债表已经被 bridge 用于财报补充，其中存在可核对的利息费用和有息负债原始分项；当前这些字段还没有进入现金流报告，导致已有来源数据没有被消费。

## What Changes

- 扩展 bridge 财报标准化记录，保留 `FE_INTEREST_EXPENSE`/`INTEREST_EXPENSE` 和资产负债表有息负债分项及显式合计。
- 扩展 AkShare 来源候选：Tencent/Sina 日线、代码名称表、Eastmoney 指标版、季度/年度利润表、年度资产负债表、季度/年度现金流量表和 Sina 财报。
- 将同报告期的利润表、资产负债表字段补充到 bridge cashflow 记录。
- 扩展 API AkShare cashflow parser 和 provider chain，只对主来源的空利息/债务字段做同报告期补充。
- 增加报表代码校验、端点错误与来源元数据测试，保留未映射股利和其它字段的 `null` 边界。

## Non-Goals

- 不从财务费用、总负债、总资产或权益推算利息/有息负债。
- 不跨报告期合并，也不覆盖 Eastmoney/Tushare 已有有限值。
- 不改变分红、推荐、评分、D1 schema 或日线同步。

## Impact

- Bridge：normalizer、statement/cashflow adapter、README 和 Python tests。
- API：AkShare cashflow mapping、cashflow provider merge contract 和 tests。
- Quant UI：沿用现有现金流 evidence parser 与来源文案，无新增页面协议。

## Verification

- 覆盖同报告期利息/债务补充、主值优先、报表代码错配、单端点失败、日线/身份/季度/年度/Sina fallback、恢复后的 ready 状态、未映射字段 null 和空来源。
- 通过 bridge/API/Quant 定向测试、root lint/type-check/build、OpenSpec strict、GitNexus 与 Gateway 匿名契约检查。
