## 设计概览

本 change 只修复已有 Quant 证据链的状态边界，并在现有 Eastmoney provider 内增加一个字段级公开明细读取。不会新增 D1、缓存或用户配置。研究报告、因子评分和 AI 结果继续读取各自已有快照；刷新后才会生成包含新 PEG 的新研究报告。

## 因子数据健康

`quant-factor-data-health.ts` 将有限 `value` 作为原始字段是否存在的唯一数据覆盖依据，并把来源状态单独合并：

- `missingEvidenceKeys` 只包含没有 evidence、`missing` 状态或非有限值。
- `failedEvidenceKeys` 只表示有限值未通过研究阈值，保留给风险展示。
- `usableEvidenceCount` 统计有有限值且来源不是不可用的 evidence。
- 因子状态只有在真实缺口、来源不可用或因子模型本身未就绪时降级；失败阈值不再降级字段健康。
- 失败 evidence 不进入刷新 key；来源回退、来源不可用、aging/stale 和真实缺口仍保留现有刷新入口。

来源分类先识别回退链，再识别没有回退的失败，确保“主源失败 + 回退成功”得到 `fallback`。

## 估值补充

`createEastmoneyValuationProvider` 保留现有行情接口作为主读取。主读取成功后，如果任一支持字段为空，则调用 `RPT_VALUEANALYSIS_DET` 的每日估值明细接口，读取最新 `TRADE_DATE` 行。字段映射支持当前明细字段（`PE_TTM`、`PE_LAR`、`PB_MRQ`、`PS_TTM`、`PEG_CAR`、`TOTAL_MARKET_CAP`）以及既有测试回退字段；合并操作只对主值为 `null` 的字段生效。

主接口失败时仍使用原有回退路径；主接口成功而明细请求失败时保留主快照，不把可选补充失败升级成整次估值失败。

## 现金流空响应

现金流日期请求使用专用空列表解析：合法 JSON `null`、`data: null` 和 Eastmoney 空对象标记都转为空数组；其他 statement 仍保持严格结构校验。这样保险股没有现金流表时显示 `insufficient_data`，而真实坏响应仍通过现有安全错误码暴露。

## 行业财报字段

Eastmoney 的 `ZYZBAjaxNew` 同时返回 `ORG_TYPE` 和行业专用指标。provider 只把这些源站原始字段归一化到可选的 `industry`/`industryMetrics`，不把银行、保险的总负债结构当作普通制造业的毛利率、资产负债率或现金比率解释。

研究证据通过 `applicability=not_applicable` 表达通用字段不适用；因子模型、因子数据健康和候选证据覆盖计算会排除这些字段，并保留行业专用指标作为可核对证据。行业专用指标没有足够同业样本时显示“暂无同业可比样本”，不生成刷新动作。

PEG 仍要求正值。Eastmoney 返回负 PEG 时保留原始返回事实用于研究风险，但价值质量比较将其视为不可比字段，不使用推算值。

## 财报来源扩展

财报 provider 保持 Eastmoney 为默认主源；当环境存在 Tushare token 时，`fina_indicator` 作为可选回退源。只有显式设置 `QUANT_DATA_PROVIDER=tushare` 时才让 Tushare 成为财报主源，避免已有日线 Tushare 配置意外丢失 Eastmoney 的行业专用指标。

当主源报告仍有可支持的 `null` 字段时，provider 按相同 `reportDate` 请求另一个已配置来源，仅填充主源为空的字段。结果保留主源 `provider`，并通过 `supplementalProvider`/`supplementUsed` 记录字段补充；主源整体失败后切换到回退源时，记录 `fallbackUsed` 与安全错误码。回退读取失败不覆盖已经成功的主源报告。

Tushare 只映射 `fina_indicator` 中已定义的通用财务字段，不能补造 Eastmoney 的银行/保险专用字段；报告日期、股票代码和有限数值均需再次校验。来源标签和研究报告 sources 同步实际命中的 provider，供数据健康页区分“字段补充”和“来源不可用”。

现金流复用同样的来源顺序。Tushare `cashflow` 只提供已确认的经营活动净现金流、购建长期资产支出和现金流量表净利润；由于 `c_pay_dist_dpcp_int_exp` 同时包含股利、利润或利息支付，不把它映射成单独现金股利，利息和有息负债也不从该接口推导。Eastmoney 返回空历史时，Tushare 有匹配报告即可形成核心自由现金流证据；两端均为空时仍返回 `insufficient_data`。

## 验证

- Vitest：因子健康、provider、股东回报和相关路由。
- TypeScript：API 与 Quant app type-check/build。
- OpenSpec：`validate --changes --strict --no-interactive`。
- Gateway：认证态 `/quant/` 详情验证 PEG 补充、趋势失败字段覆盖、股东回退状态和 601318 现金流不足状态；检查页面无 console error/warn 与横向溢出。
