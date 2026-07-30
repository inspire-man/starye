# Phase 17: Local Runner Vertical Slice - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 17-Local Runner Vertical Slice
**Areas discussed:** 本地 runner 运行方式、实际入库与 receipt 验收、取消请求与协作停止、最小 Dashboard 操作入口

---

## 本地 runner 运行方式

| Decision | Alternatives considered | Selected |
|----------|-------------------------|----------|
| 领取方式 | 常驻轮询并 claim / supervisor 子进程 / 手动一次性 CLI | 常驻轮询并 claim ✓ |
| 单机容量 | 全局单任务 / 视频漫画各一项 / 可配置多并发 | 全局单任务 ✓ |
| runner 离线 | 保持 queued / 10 分钟失败 / 创建时拒绝 | 保持 queued ✓ |
| 实际执行覆盖 | 视频漫画均实际执行 / 视频优先 / 漫画优先 | 视频漫画均实际执行 ✓ |

**User's choice:** 常驻、单机串行、离线排队的 runner，同时验证两个固定模板。
**Notes:** API 继续只承担控制面，Node/Puppeteer 进程不在 Worker 内运行。

---

## 实际入库与 receipt 验收

| Decision | Alternatives considered | Selected |
|----------|-------------------------|----------|
| 成功证据 | API 重查核验 / 信任 runner / 库内计数差 | API 重查核验 ✓ |
| 内容链接 | 主内容 ID + 汇总 / 全量 ID / 仅计数 | 主内容 ID + 汇总 ✓ |
| 空入库结果 | `receipt_missing` 失败 / 无变化成功 / 部分成功 | `receipt_missing` 失败 ✓ |
| 后续内容操作 | 可回退编辑 / 完整创建编辑删除 / 只读 | 可回退编辑 ✓ |

**User's choice:** success 必须有 API 可验证 receipt；从主内容标识进入既有 CRUD 后做可恢复编辑验证。
**Notes:** 正常进程退出不能替代有效 receipt。

---

## 取消请求与协作停止

| Decision | Alternatives considered | Selected |
|----------|-------------------------|----------|
| runner 停止 | 安全检查点协作停止 / 立即中断进程 / 跑完整项 | 安全检查点协作停止 ✓ |
| 等待呈现 | 二次确认并保留 cancel_requested / 即点即取消 / 直接显示已取消 | 二次确认并等待确认 ✓ |
| 部分入库 | 保留内容但 run 取消 / 尝试回滚 / 直接成功 | 保留内容但 run 取消 ✓ |
| 验收路径 | 可控 crawler + 真实 crawl / 仅真实 crawl / 仅单元测试 | 可控 crawler + 真实 crawl ✓ |

**User's choice:** 取消准确反映 runner 确认，避免强杀和不可靠来源站时序测试。
**Notes:** 已入库数据保留审计，但不以取消任务的部分内容宣告成功。

---

## 最小 Dashboard 操作入口

| Decision | Alternatives considered | Selected |
|----------|-------------------------|----------|
| 入口位置 | 扩展现有 Crawler 页面 / 新独立页 / 无 UI | 扩展现有页面 ✓ |
| 刷新 | 可见时 5 秒轮询 + 命令后刷新 / 手动 / 实时推送 | 5 秒轮询 + 命令后刷新 ✓ |
| 日志 | 50 条 + 游标 / 最后一条 / 全量加载 | 50 条 + 游标 ✓ |
| 创建入口 | 两个固定模板按钮 / API CLI 创建 / 等待 Phase 19 | 两个固定模板按钮 ✓ |

**User's choice:** 在既有页面提供可用的最小闭环；完整任务运维体验留给 Phase 19。
**Notes:** 日志保持结构化和脱敏，不纳入实时流式能力。

---

## the agent's Discretion

- runner CLI 名称、轮询退避、event code、薄适配器、测试 fixture 与路径命名。

## Deferred Ideas

- GitHub Actions 生产编排与补偿：Phase 18。
- 完整 Dashboard 运营体验、实时日志、RUNBOOK 和双环境端到端验收：Phase 19。
