# Phase 10: Storage Code Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 10-Storage Code Cleanup
**Areas discussed:** 共享 storage contract, 旧假设清理范围, 测试补强深度

---

## 共享 storage contract

| Option | Description | Selected |
|--------|-------------|----------|
| 共享纯 contract/helper 层 | 共享 purpose、prefix、key/url helper，运行时仍分端保留 | ✓ |
| 更高层 shared storage service | API 与 crawler 共用更重的运行时服务 | |
| 只补类型和常量 | 不抽 helper，仅统一 types/constants | |
| 其他 | 自定义方案 | |

**User's choice:** 共享纯 contract/helper 层。
**Notes:** 用户明确不要做更高耦合的 shared runtime service，优先收口纯 policy / helper。

| Option | Description | Selected |
|--------|-------------|----------|
| policy + key/url helper | 统一 purpose、prefix、key builder、R2/external URL 判定 | ✓ |
| 再加 upload target 校验 | 连 crawler namespace rule 一起进一步共享 | |
| 只做 key builder，不碰 URL 判定 | 最小化共享范围 | |
| 其他 | 自定义范围 | |

**User's choice:** policy + key/url helper。
**Notes:** 用户优先解决 API/crawler contract 漂移，而不是把所有 target 校验一次性打平。

| Option | Description | Selected |
|--------|-------------|----------|
| 继续放大 `@starye/api-types` | 沿用现有 shared purpose/prefix 落点 | ✓ |
| 新建专门 storage 共享包 | 用新 package 承载 storage contract/helper | |
| 只在 API 侧放 helper 再让 crawler 跟随 | 不建立真正共享落点 | |
| 其他 | 自定义落点 | |

**User's choice:** 继续放大 `@starye/api-types`。
**Notes:** 用户偏好最低摩擦路径，不想在本 phase 引入新 package 边界。

| Option | Description | Selected |
|--------|-------------|----------|
| 只做封装，不改现有 key 形状 | 收口 helper，但保留现有 prefix / key contract | ✓ |
| 允许轻量命名整理，但不迁历史对象 | 可对新 helper 命名做小调整 | |
| 其他 | 自定义处理方式 | |

**User's choice:** 只做封装，不改现有 key / prefix 形状。
**Notes:** 用户明确压缩 blast radius，不借 Phase 10 触发历史对象路径兼容问题。

---

## 旧假设清理范围

| Option | Description | Selected |
|--------|-------------|----------|
| 只清脚本/测试硬编码假设 | 不动后台 heuristics | |
| 脚本/测试 + 明显后台 heuristics | 同时清理 legacy script 与 admin 侧旧判断 | ✓ |
| 只清 comic/storage 主链路 | actor/publisher 先保持现状 | |
| 其他 | 自定义范围 | |

**User's choice:** 脚本/测试 + 明显后台 heuristics。
**Notes:** 用户希望本 phase 真正清掉仓库内残留的 R2-first 语义，而不只是修一半。

| Option | Description | Selected |
|--------|-------------|----------|
| 外链也可以是合法终态 | policy-aware 判断，不再把非 R2 直接视为待修复 | ✓ |
| 只放宽筛选，不改字段语义和命名 | 轻改逻辑，不整理语义 | |
| 维持后台逻辑不动，只改脚本说明 | 最小改动 | |
| 其他 | 自定义口径 | |

**User's choice:** 外链也可以是合法终态。
**Notes:** 这条直接约束 actor/publisher 的 pending/update heuristics 不能再依赖 `R2_PUBLIC_URL` 前缀判断。

| Option | Description | Selected |
|--------|-------------|----------|
| 改成 policy-aware 默认行为 | 默认接受合法外链与必要资产 R2 并存 | ✓ |
| 保留旧行为，但标成 optional / legacy | 只降权不改默认语义 | |
| 两者都做 | 改关键脚本，同时标部分脚本为 legacy | |
| 其他 | 自定义处理方式 | |

**User's choice:** 改成 policy-aware 默认行为。
**Notes:** 用户不满足于注释式修补，希望关键脚本本身就输出正确的默认判断。

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现有字段名，修正判定语义与注释/测试 | 压低 API / 前后端联动 blast radius | ✓ |
| 连字段/日志命名一起改成新语义 | 一次性把名字和语义都改正 | |
| 折中：内部新语义，对外先兼容保留 | 内外分层过渡 | |
| 其他 | 自定义方案 | |

**User's choice:** 保持现有字段名，修正判定语义与注释/测试。
**Notes:** 用户更重视安全收口而不是 API surface 美化。

---

## 测试补强深度

| Option | Description | Selected |
|--------|-------------|----------|
| shared helper 为主，补聚焦回归 | 单测 shared helper，再给调用点补最小回归 | ✓ |
| helper + 少量跨层集成回归 | 比 option 1 更重一些 | |
| 尽量补成高层回归 | 大量重测已有链路 | |
| 其他 | 自定义测试深度 | |

**User's choice:** shared helper 为主，补聚焦回归。
**Notes:** 测试策略要贴近 Phase 10 目标，不重复前面 phase 已通过的高层验证。

| Option | Description | Selected |
|--------|-------------|----------|
| shared helper contract 不一致风险 | 优先守 API / crawler 两边再次漂移 | ✓ |
| 后台 heuristics 误判风险 | 优先守 admin 侧 policy-aware 判断 | |
| legacy 脚本旧语义风险 | 优先守脚本默认行为 | |
| 平衡覆盖 | 三类都补最小关键回归 | |
| 其他 | 自定义优先级 | |

**User's choice:** shared helper contract 不一致风险。
**Notes:** 用户最关心这期之后还会不会继续出现“两边各写各的”漂移。

| Option | Description | Selected |
|--------|-------------|----------|
| shared helper 单测 + 现有调用点最小回归 | shared 层直接测，调用点保最小接线测试 | ✓ |
| 只在调用点测，不给 shared helper 单独建测试 | 不新增 shared 层测试 | |
| shared helper 重测，调用点几乎不测 | 把测试集中在 shared 层 | |
| 其他 | 自定义落点 | |

**User's choice:** shared helper 单测 + 现有调用点最小回归。
**Notes:** 这条直接限定 Phase 10 的 test allocation：shared helper 必须有独立覆盖。

| Option | Description | Selected |
|--------|-------------|----------|
| 不重复造高层回归，只在受影响调用点补 smoke | 复用已有 Phase 7/8 coverage | ✓ |
| 顺手补一点更完整的高层回归 | 如果碰到相关文件可补少量集成测试 | |
| 其他 | 自定义策略 | |

**User's choice:** 不重复造高层回归，只在受影响调用点补 smoke。
**Notes:** 用户明确避免把本 phase 扩成一次全面 re-verification。

---

## the agent's Discretion

- 可自行决定 `@starye/api-types` 中 shared helper 的具体函数拆分与命名，只要保持纯 contract/helper 边界。
- 可自行决定最小 smoke 测试分布，但必须满足 shared helper 直测 + API/crawler 最少各一处接线回归。

## Deferred Ideas

None.
