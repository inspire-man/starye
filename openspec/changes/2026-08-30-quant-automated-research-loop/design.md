## 设计边界

### 自动研究闭环

候选页把当前筛选结果前 3 只或用户勾选的候选交给本地工作流。每只股票按以下顺序执行：

1. 确认 `quant_watchlist` 中存在该股票；不存在时复用现有观察池写入接口。
2. 调用现有研究 run 接口，生成并持久化带因子配置快照的确定性报告。
3. 若 AI 配置可用，调用现有摘要接口；摘要接口持久化因子级复核。AI 失败只标记该项 AI 阶段失败，确定性报告仍可查看。
4. 刷新候选、观察池和决策待办，默认把第一只完成的股票打开详情。

工作流状态仅用于当前页面反馈，报告和摘要仍分别以现有 D1 表为权威来源；重复执行生成新的研究 run，不覆盖历史报告。

### AI 因子复核

`QuantAiSummary` 增加 `factorReviews`。每项包含 `factor`、`stance`、`confidence`、`accepted`、`rationale` 和 `citedEvidenceKeys`。`factor` 必须属于报告因子模型，引用必须属于该因子的 evidence keys。

服务端根据报告重算 `accepted`：因子必须有可用分数、复核置信度至少 60、至少引用一条属于该因子的证据，且 stance 不能是 `insufficient`。整体 `decisionReview` 只有在报告覆盖度至少 80、总体置信度至少 60、总体引用非空且因子复核覆盖与方向不冲突时才 accepted。没有因子模型或历史摘要没有 `factorReviews` 时保留现有兼容行为。

因子复核只影响 AI 决策复核是否可作为覆盖层；确定性 `factorModel`、配置权重、`decision.deterministicScore` 和买卖参考区间不被改写。

### 持久化与读取

不新增 D1 表。新的 `factorReviews` 保存在现有 `quant_research_summary.summary_json`；保存用户决策时将同一份已校验的因子复核复制到 `quant_decision_record.snapshot_json` 的 `aiFactorReviews`。后端和前端读取历史 JSON 时缺省为 `[]`，并重新校验因子、引用、数值范围和版本。

### UI

自动研究区域放在候选页证据就绪度之后，显示批次总进度和每只股票当前阶段；支持重试失败项、查看已完成研究、配置 AI。研究详情的 AI 摘要区域增加因子复核列表，明确每项是否纳入最终推荐、引用证据和拒绝原因。

## 验证策略

- AI 领域单测覆盖合法因子复核、未知因子/跨因子引用、低置信度、数据不足、方向冲突和旧摘要兼容。
- 决策快照单测覆盖 `aiFactorReviews` 持久化、旧快照缺省和损坏数据拒绝。
- Quant API client、自动批次 helper、组件和 API 集成测试覆盖逐项状态、部分失败、用户隔离和持久化读回。
- 运行 API/Quant type-check、定向测试、build、lint、OpenSpec strict；经 Gateway 验证桌面与 390px 候选页和研究详情无浏览器错误或页面横向溢出。
