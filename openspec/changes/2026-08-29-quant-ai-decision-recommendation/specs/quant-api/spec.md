## MODIFIED Requirements

### Requirement: Research report and AI summary decision contract

在原有研究报告与 AI 摘要接口基础上，`POST /api/quant/research/runs` 返回的报告 MUST 包含版本化 `factorModel` 和 `decision`；`POST /api/quant/research/runs/:runId/summary` 及其历史读取 MUST 返回 AI 决策复核字段。服务端仍 MUST 从当前用户拥有的已保存报告读取 AI 输入，不接受客户端提交的报告、因子、价格或 API key。

#### Scenario: Generate a report with decision projection

- **WHEN** 已认证 Quant 用户生成指定观察池股票的研究报告
- **THEN** 响应包含 `factorModel`、确定性推荐、覆盖度、失效条件和可追溯参考价格区间
- **AND** 研究报告仍持久化到现有 `quant_research_run.report_json`

#### Scenario: Generate an AI decision review

- **WHEN** 用户为已保存研究运行生成 AI 摘要
- **THEN** AI 请求体只包含该运行的服务端报告事实，响应包含摘要文字与结构化决策复核
- **AND** `quant_research_summary.summary_json` 与 `cited_evidence_keys_json` 可通过 D1 读回

#### Scenario: User isolation and forged input rejection

- **WHEN** 用户读取或生成其他用户的研究运行摘要，或在请求中附加客户端伪造的报告、因子、价格和 key
- **THEN** API 返回稳定的鉴权/不存在/输入错误，且不发起 AI 请求、不写入研究数据

### Requirement: Quant API data completeness

研究报告的股东回报因子 MUST 继续使用实施现金分红与本地最新正收盘价计算近 12 个月股息率；来源错误、没有实施分红或没有本地价格时 MUST 保持 `null` 并影响决策覆盖度。

#### Scenario: Dividend yield feeds the report factor model

- **WHEN** 股息 provider 返回实施记录且日线库存在最新正收盘价
- **THEN** 报告的股东回报因子引用 `shareholder-yield`，并将股息率纳入因子得分

#### Scenario: Dividend yield remains missing

- **WHEN** Tushare 未配置、请求失败或只有预案/无本地收盘价
- **THEN** 报告显示股息率缺失和来源状态，最终推荐至少降为 `watch`
