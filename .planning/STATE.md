---
status: idle
milestone: v1.5
milestone_name: 爬虫运管与内容可用性闭环
last_updated: "2026-09-05"
---

# Project State

## 当前

v1.5 已完成、归档、部署；当前没有 active phase 或 pending plan。Quant 下一轮 change `2026-09-05-quant-shareholder-sustainability-evidence` 正在 `codex/quant-shareholder-sustainability` 分支推进。

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

- 2026-09-05 Quant 股东回报可持续性 evidence change 已完成 domain、research、API schema、client/view model、详情 UI 和 fixture 实现；定向 API 269 项、Quant 317 项、root lint、type-check、build、OpenSpec strict 84/84、GitNexus 变更检查和 Gateway 匿名边界通过。认证态 Gateway 页面已确认紫金矿业 5 期历史和覆盖统计，1280px/390px 无页面级横向溢出，修复详情视图组件注册 warning 后新增 console error/warn 为 0。API 全量本地单 worker run 未完成。

## 延后事项

- 历史 Phase 13 selected-production Viewer proof 保持冻结；v1.4 使用独立 fresh tuple。
- 历史 artifact-audit/debug sessions 只作为背景，不阻塞当前开发。
- `@starye/config` lint baseline 是独立技术债。

## 下一步

1. 新功能：读 [`../openspec/README.md`](../openspec/README.md)，建立并推进一个 change。
2. 小 bug：定位 → 最小修复 → 定向测试 → Gateway 验证。
3. crawler/D1：补 Gateway、D1 readback、content integrity 和实际消费层证据。
4. 完成后更新本文件的当前状态；稳定规则回写对应 canonical owner。

## 历史入口

- 里程碑与 phase 证据：[`milestones/`](./milestones/)
- 旧专题文档：[`../docs/archive/`](../docs/archive/)
- spec/change 历史：[`../openspec/`](../openspec/)

历史文件默认不读，只有任务明确要求追溯时才打开。
