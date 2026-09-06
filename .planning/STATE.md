---
status: idle
milestone: v1.5
milestone_name: 爬虫运管与内容可用性闭环
last_updated: "2026-09-06"
---

# Project State

## 当前

v1.5 已完成、归档、部署；当前没有 active phase 或 pending plan。Quant 证据来源补全 change 已合入 `main`，下一轮开发从合并后的 `main` 开始。

## 最近验证

- 生产部署与 CI workflows：通过，SHA `184e2941863a30640536aa97c35e798f84cf5144`。
- Manga Crawl：workflow `32536822682`，D1 run `9ee3320b-4726-4b3a-9d51-a2c6de9c972d`，provider `github-actions`，成功。
- 章节 `790-34389`：25/25 页面可用，D1 readback 与浏览器图片解码通过。
- Reader 生产匿名 R18 状态未作为完整 UI 证明；完整 tuple 在 v1.5 Phase 28 归档中。
- Quant 今日决策助手第 4 组已完成并合入 `main`：服务端 Eastmoney 实时行情与本地收盘回退、服务端现价请求收敛、AI checkbox 样式回归和紫金矿业 Gateway/D1 验证均通过；OpenSpec `2026-08-30-quant-daily-decision-assistant` 为 14/14。
- Quant 自动研究闭环与数据新鲜度验收已完成并合入 `main`：OpenSpec strict 77/77；Gateway 候选页确认真实 AI 配置、3 项闭环逐项状态、AI 失败保留确定性报告、详情回看、390px 无横向溢出且无浏览器 error/warn。
- Quant 自动研究闭环诊断已完成并合入 `main`：失败项按入池、研究、AI 阶段展示安全错误码，保留报告回看与重试；OpenSpec `2026-09-03-quant-research-pipeline-diagnostics` 已通过 strict，Gateway 真实 AI 失败和 390px 页面验证通过。
- Quant 模块化架构第一阶段已完成并合入 `main`（PR #75，merge SHA `69a12c72c988d692f3590cb8fadb47444d32c770`）：API workspace/candidate service、Quant API resource/transport、Overview/Shell/Watchlist/Candidates/Knowledge/Research Detail/Comparison 视图、Pinia 导航/候选/初始化状态和异步 chunk 已拆出；Quant 前端继续拆分 AI briefing、decision assistant、decision journal、AI trust overview、research summary、recommendation 的职责组件，route tests 已按领域拆分，`quant-types.ts` 已移除并分离为 transport DTO 与 UI view model。Quant 65 个测试文件/316 项测试、API 118 个文件/881 项测试、API/Quant/DB/contract type-check、API/Quant/contract build、边界检查、OpenSpec strict 与 GitNexus 变更分析均通过。
- 2026-09-04 Quant 模块化 change 已完成并合入 `main`：OpenSpec 17/17；47 个 endpoint 的 runtime route、OpenAPI、输入/输出/status/error contract matrix 对齐；Gateway 匿名访问重定向、普通用户与管理员 session、用户隔离、mutation response 与 D1 readback、AI 配置脱敏、SSE `started/delta/completed`、summary/audit 持久化均通过。Playwright 1280px/390px `/quant/#overview` 均无横向溢出，console error/warn 为 0，截图证据保留于 `output/playwright/quant-modular-20260904/quant-desktop-final.png` 与 `output/playwright/quant-modular-20260904/quant-mobile-final.png`；本地 fixture 已清理，D1 相关计数归零。
- 2026-09-05 Quant 股东回报现金流、股本/回购股数、已实施回购金额、利息与有息负债四个 evidence change 已合入 `main`（PR #76，merge SHA `e309e8851d80069c16afc6670346f147f747bc5d`）；合并 SHA 的 CI `33942993937`、API 部署 `33942993878`/`33942993884` 和 Quant 部署 `33942993934` 均通过。

- 2026-09-05 Quant 股东回报可持续性 evidence change 已合入 `main`（PR #77，merge SHA `acc0f633d1934929e3380b45a262a1090eff0b22`）：定向 API 269 项、Quant 317 项、root lint、type-check、build、OpenSpec strict 84/84、GitNexus 变更检查通过；PR test、合并 SHA 的 CI、Deploy API、Deploy API After PR Merge、Deploy Quant 全部通过。合并后 Gateway 已确认匿名 `/quant/` 为 302、股东回报 API 为 401，认证态紫金矿业详情显示 5 期历史和覆盖统计，1280px/390px 无页面级横向溢出且 console error/warn 为 0。API 全量本地单 worker run 未完成。
- 2026-09-05 Quant 价值质量边界文案修复已合入 `main`（PR #78，merge SHA `9a0174e44e039c06526ec3b44a564799c3d2cb73`）：过期的“资本开支、回购和分红支付率暂未接通”提示已改为独立展示边界；组件 11/11、Quant type-check/build、认证态 Gateway 文案和 console 验收通过，合并 SHA 的 CI 与 Deploy Quant 均通过。
- 2026-09-05 Quant 数据健康刷新入口修复已合入 `main`（PR #79，merge SHA `4df0bde381f7d65a2f91ecb23c3802875c20c959`）：aging/stale 数据域现在显示已有刷新动作，完整度与新鲜度计算保持独立；数据健康/Overview 10 项、Quant 全量 317 项、type-check/build、边界检查通过，认证态 Gateway 已确认“日线同步：去更新日线”，合并 SHA 的 CI 与 Deploy Quant 通过。
- 2026-09-05 Quant 缺失证据刷新入口已合入 `main`（PR #80，merge SHA `44420cbae32a93bc9a88ecde108fd6d803fc4cac`）：因子数据健康按 evidence key 提供日线、估值、基本面、股东回报的“刷新并重算”入口，候选列表提供“去补齐”直达详情；刷新只重算确定性报告，不自动提交 AI，AkShare bridge 缺口继续保留为来源问题。Quant 全量 321 项、type-check/build、root lint、边界检查、认证态 Gateway loading/success/候选入口验证通过；PR CI `33969770950`、合并 SHA CI `33970002924` 和 Deploy Quant `33970002956` 均通过。
- 2026-09-06 Quant 证据来源补全已合入 `main`（PR #81，merge SHA `3723d2baaddd618b5ad9a5c28f01aff3be2d99b2`）：区分阈值失败、真实缺失、来源回退、来源不可用和银行/保险行业不适用字段；Eastmoney PEG 明细、财报 `fina_indicator` 和现金流 `cashflow` 的可选 Tushare 回退链已接通，详情页与研究报告同步来源元数据。PR CI `34000465004`、合并 SHA CI `34000682737`、Deploy API `34000682861`、Deploy API After PR Merge `34000682779`、Deploy Quant `34000682792` 均通过。认证态 Gateway 已验证 601318 保险指标、000001 银行指标、负 PEG、刷新动作和行业不适用历史口径；1920px/390px 无横向溢出且浏览器 error/warn 为 0。
- 2026-09-06 Quant 现金流来源扩展已合入 `main`（PR #84，merge SHA `5c9ea56467fcc4fa06bf673f9fe5ac6913152dcb`）：现金流接入同报告期利息费用和有息负债分项；AkShare 增加 Eastmoney 指标、季度/年度/Sina 财报、Tencent/Sina 日线和代码名称 fallback；恢复后的完整响应保持 `ready`，端点异常继续保留在 `errors`。本地 bridge 34 项、API 定向 66 项、Quant 330 项、root lint/type-check、Quant/API build、OpenSpec strict 85/85 通过；Gateway 匿名 `/quant/` 为 302、现金流 API 为 401。PR CI `34015267195`、合并 SHA CI `34015480148`、Deploy API `34015480141`、Deploy API After PR Merge `34015480137` 均通过。root 全量 build 仍受既有 `STARYE_PAGES_BUILD_ENV_PATH` 缺失影响。
- 2026-09-06 Quant 来源覆盖语义修复已合入 `main`（PR #85，merge SHA `baa475c45e845a95a657e8b33852ab230b0cf2b6`）：Eastmoney 回购合法空响应（`9201`）归类为 `insufficient_data`，银行/保险 `not_applicable` evidence 不再阻断判断就绪度；真实回购记录仍保持来源独立，未用计划金额或零值补齐。
- 2026-09-06 Quant AkShare 回购备用来源已合入 `main`（PR #86，merge SHA `d29e904e61330ab5977079c80bb58947419e56ed`）：bridge 接入 `stock_repurchase_em`、按证券过滤并缓存全量表，Eastmoney 空历史/失败时回退 AkShare，API、研究报告和详情保留实际来源与安全回退原因；PR checks、合并 SHA CI、Deploy API、Deploy API After PR Merge、Deploy Quant 均通过，匿名 Gateway `/quant/` 为 302、股东回报 API 为 401。
- 2026-09-07 Quant AkShare 分红历史备用来源已合入 `main`（PR #87，merge SHA `198eba931fa943515cf8c2c3da15c319d6af33ea`）：bridge 接入 `stock_history_dividend_detail`，按每十股到每股转换现金分红，Tushare/Eastmoney 空历史或失败时回退 AkShare，研究报告 factor provenance 保留 `akshare-dividend`；PR checks、合并 SHA CI、Deploy API、Deploy API After PR Merge、Deploy Quant 均通过，匿名 Gateway `/quant/` 为 302、股东回报 API 为 401。
- 2026-09-07 Quant AkShare 同报告期现金分红字段已合入 `main`（PR #88，merge SHA `2e4b553bcddba37c4325b94b6f340927f5f88d3f`）：bridge 保留 `ASSIGN_DIVIDEND_PORFIT` 为 `cash_dividends_paid`，API 贯穿 `cashDividendsPaid`，缺失/非有限值保持 `null`；PR CI `34048787892`、合并 SHA CI `34049102211`、Deploy API `34049102223`/`34049102192` 和 Deploy Quant `34049102159` 均通过，Gateway `/quant/` 为 302、匿名股东回报 API 为 401。
- 2026-09-07 Quant AkShare 现金流来源覆盖已合入 `main`（PR #89，merge SHA `bfbb379e4fd48a89ebc92af7ab239a07cd4998cc`）：接入同花顺 `stock_financial_cash_new_ths` 现金流备用端点，累计 `value` 映射现金流字段；现金流缺失净利润仅从同报告期利润表的净利润总额补入，保留归母净利润口径独立字段；PR CI `34052848071`、合并 SHA CI `34053054393`、Deploy API `34053054428`、Deploy API After PR Merge `34053054478` 均通过，Gateway `/quant/` 为 302、匿名股东回报 API 为 401。
- 2026-09-07 Quant AkShare 公司股本结构备用来源已合入 `main`（PR #90，merge SHA `e14faac8d5df4af10b6eec558194fdd097be5ee3`）：bridge 接入 CNInfo `stock_share_change_cninfo`，Eastmoney 股本历史为空或失败时回退 AkShare，详情和研究报告保留 `akshare` provider；PR checks `34055767804`、合并 SHA CI `34056015625`、Deploy API `34056015612`、Deploy API After PR Merge `34056015567`、Deploy Quant `34056015583` 均通过；Gateway `/quant/` 为 302、匿名股东回报 API 为 401，刷新入口实测从读取中回到最新观测状态。

## 延后事项

- 历史 Phase 13 selected-production Viewer proof 保持冻结；v1.4 使用独立 fresh tuple。
- 历史 artifact-audit/debug sessions 只作为背景，不阻塞当前开发。
- `@starye/config` lint baseline 是独立技术债。

## 下一步

1. 开发并交付当前 `2026-09-07-quant-akshare-profit-forecast` change；后续来源扩展只针对可验证的真实原始字段缺口。
2. 小 bug：定位 → 最小修复 → 定向测试 → Gateway 验证。
3. crawler/D1：补 Gateway、D1 readback、content integrity 和实际消费层证据。
4. 完成后更新本文件的当前状态；稳定规则回写对应 canonical owner。

## 历史入口

- 里程碑与 phase 证据：[`milestones/`](./milestones/)
- 旧专题文档：[`../docs/archive/`](../docs/archive/)
- spec/change 历史：[`../openspec/`](../openspec/)

历史文件默认不读，只有任务明确要求追溯时才打开。
