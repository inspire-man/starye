# Phase 11: Deployment Target Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 11-Deployment Target Foundation
**Areas discussed:** Target profile 字段边界, 本地 env 投影方式, fail-closed 校验规则, Wrangler 本地 profile 与 CI secrets 边界

---

## Target profile 字段边界

| Option | Description | Selected |
|--------|-------------|----------|
| 一个 profile = 一个可部署目标 | profile 自身完整表达 account、domain、resources、URLs、secret contract | ✓ |
| 一个 profile = account/domain，资源再从各应用配置推导 | 字段更少，但容易半切换 | |
| 多层 overlay | account/domain/resource 分层复用，但实现和校验更复杂 | |

**User's choice:** 一个 profile = 一个可部署目标
**Notes:** 资源记录深度也锁定为名称 + ID/route pattern + canonical URL + required-secret metadata 全记录；required-secret metadata 只记录名称 + 必填/选填 + 消费者；`profile.urls` 显式列出每个对外 surface 的 canonical URL。

---

## 本地 env 投影方式

| Option | Description | Selected |
|--------|-------------|----------|
| 生成各 surface 本地文件，但默认不覆盖已有文件 | 直接兼容现有 runtime 入口，避免手工复制 | ✓ |
| 只做校验，不生成文件 | 保留当前人工维护摩擦 | |
| 生成统一中间文件 | 架构更纯，但会把 Phase 11 拉成 runtime 改造 | |

**User's choice:** 生成各 surface 本地文件，但默认不覆盖已有文件
**Notes:** 输出目标锁定为现有最终消费文件；只管理 target-managed 键；切换 profile 时清理旧 target-managed 残留，用户自填 secret 原样保留。

---

## Fail-Closed 校验规则

| Option | Description | Selected |
|--------|-------------|----------|
| 任何 target identity 不一致就直接阻断 | 以硬 fail-closed 保护 deploy/migrate/crawl/smoke | ✓ |
| 只有高风险项阻断，其他 warning | 过渡更平滑，但容易漏出混 target | |
| 分命令级别定义不同严格度 | 更细，但规则复杂度明显上升 | |

**User's choice:** 任何 target identity 不一致就直接阻断
**Notes:** 校验同时覆盖 profile、投影结果和命令输入；未显式纳入 selected profile 的 legacy alias / fallback 一律阻断；高风险远程命令必须做 live 资源校验，没有可用凭证就阻断。

---

## Wrangler 本地 profile 与 CI secrets 边界

| Option | Description | Selected |
|--------|-------------|----------|
| 本地只允许 Wrangler auth profile；CI 只允许 token/account-secret，严禁混用 | 身份边界最清楚 | ✓ |
| 允许 CI 也通过 profile 名间接选择账号 | 统一感更强，但风险更高 | |
| 本地和 CI 都只谈 env/secrets | 少一层概念，但本地多账号切换体验差 | |

**User's choice:** 本地只允许 Wrangler auth profile；CI 只允许 token/account-secret，严禁混用
**Notes:** `TargetProfile` 必须显式声明期望的本地 Wrangler profile 名称；每个 target 显式映射到一个 GitHub environment / secret bundle；没有显式 target 就直接阻断。

---

## the agent's Discretion

- profile 文件格式、命令命名、target-managed 键的内部表示与占位注释格式
- live 校验采用哪组 Cloudflare API / Wrangler 子命令实现

## Deferred Ideas

- Phase 12: selected target 的实际配置消费与 workflow 改造
- Phase 13: local + production full-chain smoke
- Phase 14: old-domain cleanup、RUNBOOK 定稿、final verification mapping
