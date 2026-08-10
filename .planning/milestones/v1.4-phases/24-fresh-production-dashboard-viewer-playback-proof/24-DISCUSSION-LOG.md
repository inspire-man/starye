# Phase 24: Fresh Production Dashboard -> Viewer -> Playback Proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `24-CONTEXT.md`; this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 24-Fresh Production Dashboard -> Viewer -> Playback Proof
**Areas discussed:** Fresh tuple 与目标选择, 播放通过判定, 证据存储与 Dashboard 追溯, 失败与 checkpoint, Browser evidence 写入边界, Artifact 归属与保留, 真实播放启动方式, 迟到/重复 playback evidence

---

## Fresh tuple 与目标选择

| Decision | Selected choice | Alternatives considered |
|----------|-----------------|--------------------------|
| Proof target | 已入库且当前 `no_source`/`source_failed` 的 movie；fresh 约束落在新 task/run/attempt/provider tuple | 新抓取/新入库 movie；已 ready movie |
| Command entry | 已认证 Dashboard repair command，提交 server-owned identity/reason/target intent | API/runner 预创建 task；旧 task 新 attempt |
| Target profile | registry selected production target | 临时输入 URL/repository/workflow；只跑 local Gateway |
| Dispatch gate | 全量前置检查，缺失即 checkpoint | 只查 session/target；Dashboard 可打开即 dispatch |

**User's choice:** 以上四项均选择第 1 项。
**Notes:** fresh 指新的 control-plane tuple，不要求新的 content identity；Phase 13 carrier 不计入。

## 播放通过判定

| Decision | Selected choice | Alternatives considered |
|----------|-----------------|--------------------------|
| Source path | eligible direct 优先，无 direct 才走受控 TorrServer/Aria2，并记录 sourceType | 固定 direct；任意 resolver source |
| Pass threshold | `canplay` + `playing` + 两次 currentTime 且至少推进 1 秒，无终态 error | 任意正增量；canplay/DOM/readyState |
| Event evidence | allowlisted timeline；canplay/playing 必须，waiting/stalled/error 按实际观察，未发生显式表示 | 五类事件都必须发生；忽略负向事件 |
| Failure fallback | 当前 source 最多 2 次，再切换 eligible/受控路径，最终失败 checkpoint/failed | 首次失败即停；无限尝试 |

**User's choice:** 以上四项均选择第 1 项。
**Notes:** `waiting`/`stalled`/`error` 是诊断事实，不是健康播放的必需事件。

## 证据存储与 Dashboard 追溯

| Decision | Selected choice | Alternatives considered |
|----------|-----------------|--------------------------|
| Persistence | D1 bounded summary + 脱敏 JSON/Markdown artifact pair | artifact only；完整 timeline 全写 D1 |
| Fields | tuple/content/source/status/viewer/event timing/currentTime/artifact reference；raw URL/token/cookie/signature/runner JSON redacted | 仅最终结果；保留原始网络与 runner payload |
| Dashboard | current attempt 焦点，provider/repair/playback 分区，旧 attempts 可展开 | 单一 success badge；独立 playback 页面 |
| Audit format | canonical JSON + deterministic Markdown，tuple 文件名，schema/redaction/pair 校验 | Markdown only；仅 screenshot/trace/video |

**User's choice:** 以上四项均选择第 1 项。
**Notes:** provider success、repair/receipt success 和 actual playback 不合并。

## 失败与 checkpoint

| Decision | Selected choice | Alternatives considered |
|----------|-----------------|--------------------------|
| Layer projection | 独立保留 provider/repair/source/playback，全部同 tuple 通过才 production pass | 任一失败折叠；最后完成层覆盖 |
| Proof rerun | Player 内 bounded retry 后，新建 fresh tuple 重跑 | 同 task 新 attempt 覆盖；无限自动重跑 |
| Checkpoint vs failed | 前置/身份/证据缺失为 checkpoint；完整 tuple 终态失败为 failed；均保留部分 evidence | 全部 failed；全部 checkpoint |
| Final gate | canonical verifier 全部检查通过，人工只复核脱敏摘要 | provider/receipt/截图人工通过；local contract proof 关闭 phase |

**User's choice:** 以上四项均选择第 1 项。
**Notes:** 缺少 selected target、signed session 或 run allocation 时不得宣称 production pass。

## Browser evidence 写入边界

| Decision | Selected choice | Alternatives considered |
|----------|-----------------|--------------------------|
| Write owner | Playwright/Viewer -> server-owned endpoint -> API validation/D1 projection | verifier 直写 D1；普通 Player telemetry |
| Authorization | 同一 Gateway authenticated session + tuple binding | 一次性 nonce；无登录 endpoint |
| Submission shape | 一次 bounded terminal summary + timeline pair，支持 duplicate/conflict | 每事件一条 D1 fact；仅布尔结果 |
| Readiness projection | tuple/content/source revision 全匹配才更新 `playback_verified`，不改 source health/receipt | task-only；任意 evidence 覆盖 |

**User's choice:** 以上四项均选择第 1 项。
**Notes:** 本阶段 proof 不扩展为普通用户播放遥测系统。

## Artifact 归属与保留

| Decision | Selected choice | Alternatives considered |
|----------|-----------------|--------------------------|
| Storage | 显式 phase/CI evidence root + D1 reference，不新增 R2 | 私有 R2；仅 GitHub Actions artifact |
| Retention | 每 tuple 不可覆盖，failed/checkpoint 也保留，不公开媒体/签名 URL | 只留最新；所有 raw debug artifact 永久保留 |
| Dashboard access | Dashboard 展示 D1 summary，原件留 workspace/CI，由报告引用 | authenticated artifact endpoint；公开 URL |
| Write order | 先校验/写 artifact，再提交 D1；D1 失败保留 artifact 并 checkpoint | D1 first compensation；并行任一成功 |

**User's choice:** 以上四项均选择第 1 项。
**Notes:** 任何半份 evidence 都不构成 pass。

## 真实播放启动方式

| Decision | Selected choice | Alternatives considered |
|----------|-----------------|--------------------------|
| Start action | `autoplay: false` + visible Play button click | `evaluate().play()`/autoplay；等待自动播放 |
| Navigation | Dashboard -> MovieDetail -> source card -> Player -> Play | Dashboard 直达 Player；已知 Player URL |
| Observation | event-driven bounded wait + two currentTime samples | fixed sleep；无限等待 |
| Blocked playback | 保留实际 evidence 并 checkpoint/failed，不绕过 browser policy | muted autoplay/force play；人工接管 |

**User's choice:** 以上四项均选择第 1 项。
**Notes:** 截图、DOM、readyState 或人工接管不能替代 visible click + playing + time progress。

## 迟到/重复 playback evidence

| Decision | Selected choice | Alternatives considered |
|----------|-----------------|--------------------------|
| Duplicate | tuple + evidence identity/hash；相同 payload duplicate/accepted，冲突 conflict，不覆盖首个事实 | latest wins；全部追加由 UI 选最新 |
| Old attempt | current tuple/content/source revision CAS；late/stale/ignored 历史保留，不更新 current | 直接丢弃；有 playing 就接受 |
| Acceptance window | terminal/readback + revision match + bounded window | 相同 ID 永久接受；readback 前立即 verified |
| Outcome effect | 稳定 outcome + rejection history，不自动新建 repair attempt | conflict/late 自动 retry；直接忽略 |

**User's choice:** 以上四项均选择第 1 项。
**Notes:** current projection 始终由当前合法 tuple 控制。

## the agent's Discretion

- 具体 bounded 时间窗、错误码命名、evidence hash、D1 migration/SQL、API route naming、Playwright fixture 组织和非敏感 target label。

## Deferred Ideas

- 无新增 scope-creep idea；普通用户 playback telemetry、公开 artifact hosting、R2 evidence lifecycle、无限自动 retry 和其他内容类型 repair 保持 Phase 24 之外。
