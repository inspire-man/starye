## Context

当前 `research-report.ts` 生成确定性证据，`shareholder-return.ts` 已能计算近 12 个月股息率，`value-quality.ts` 单独计算价值质量，`ai-summary.ts` 只生成解释文本。研究运行和摘要分别写入现有 D1 JSON 列；页面已有报告证据、AI 摘要和问答组件。

## Goals / Non-Goals

**Goals:**

- 在报告生成时把来源、权重、覆盖度、股息率和参考价格区间组合成一个稳定的确定性决策投影。
- 扩展 AI 摘要为受证据白名单约束的决策复核，并让合格复核改变页面最终推荐。
- 以报告级推荐卡降低首屏认知负担，同时保留因子明细和证据追溯能力。
- 不增加 D1 表，复用已有版本化 JSON 持久化与权威读回。

**Non-Goals:**

- 不让 AI 计算或覆盖买入/卖出价格，不引入目标价、未来收益预测或自动交易。
- 不在本 change 做任意因子权重编辑器；先公开稳定的默认模型和来源，后续再单独设计用户自定义权重的持久化契约。
- 不把历史研究快照重算成新版本，也不接管未归档的其他 Quant change。

## Decisions

- **在报告领域层生成因子模型和价格区间。** `buildQuantResearchReport` 继续是单一报告构造入口，先生成 evidence，再由纯函数按固定模型聚合。这样 API、导出、历史和页面共享同一份结果，避免客户端重复计算。
- **股息率作为决策关键因子而非可选装饰。** 现有 `shareholder-yield` evidence 继续保留，因子模型将其列为关键因子；缺失只降低覆盖度并将结论收敛为观望，不伪造零收益。
- **AI 复核附着在现有摘要版本。** 新摘要使用 `research-summary-v2`，新增 `decisionReview`；历史 `research-summary-v1` 读取时 `decisionReview` 为空。这样不改变 `quant_research_summary` 表结构，也保持已有摘要可读。
- **最终推荐采用置信度门槛。** AI 复核必须引用当前报告 evidence key 且置信度至少 60 才覆盖页面推荐；否则页面明确显示确定性推荐。价格始终来自报告的确定性 `decision.priceRanges`。
- **区间公式保持保守且可解释。** 买入区间以 MA20 与最新收盘价的较低/较高值形成 pullback/reclaim 区间；卖出区间以最新收盘价与最近 60 根有效日线最高收盘价形成 reference-resistance 区间。缺少任一 required bar 时返回空区间，并写入公式版本和 evidence key。
- **页面使用独立组件。** 新增 `QuantDecisionRecommendation.vue` 负责展示报告决策与 AI 复核，`App.vue` 只传递已解析的 report/summary，避免组件直接访问 API 或兄弟组件。

## Risks / Trade-offs

- [风险] AI 与确定性推荐相反 → 仅接受合法 evidence key 且置信度至少 60 的复核，并同时展示两者；价格区间不由 AI 改写。
- [风险] 新摘要字段使旧历史记录缺少复核 → 通过明确的 `research-summary-v1`/`v2` 解析边界返回 `decisionReview: null`，新生成记录始终写 v2。
- [风险] 价格区间被误读为保证价位 → 字段命名为参考区间，始终附带公式、来源、观察时间和页面口径说明。
- [风险] Tushare 股息来源未配置导致覆盖度下降 → 继续显示缺失原因和“观望 / 数据待补”，不阻塞报告其它数据的展示。

## Migration Plan

无需 D1 schema migration。发布前运行领域、路由、客户端和组件测试，并用本地 D1 插入旧版摘要验证历史读取；发布后通过 Gateway 生成一份新报告和 AI 复核，再读回 `quant_research_run.report_json`、`quant_research_summary.summary_json` 与引用 key。回滚时保留旧 JSON，页面对 v1 摘要隐藏 AI 复核区即可。
