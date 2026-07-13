# Phase 8: Cost Guardrails - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 8-Cost Guardrails
**Areas discussed:** Purpose 字典与入口边界, 生命周期保留窗口, 成本审计与预算提醒阈值

---

## Purpose 字典与入口边界

### `/api/upload` 的 purpose 字典

| Option | Description | Selected |
|--------|-------------|----------|
| 业务化且窄口径 | 只给通用上传入口开放少量人工资产 purpose，内部前缀不暴露 | ✓ |
| 存储前缀直出 | 直接把 `mappings`、`tmp` 等前缀暴露给 API/UI 调用方 | |
| 极简字典 | 只保留 `manual_asset` / `temp` 两类 | |
| 其他 | 用户自由定义 | |

**User's choice:** 业务化且窄口径  
**Notes:** 用户明确不希望内部运维/脚本前缀暴露给 `/api/upload`。

### 富文本插图 purpose

| Option | Description | Selected |
|--------|-------------|----------|
| `blog_inline` | 博客正文插图单独审计 | ✓ |
| `manual_asset` | 与其他人工资产混用 | |
| `content_image` | 更泛的内容图片 purpose | |
| 其他 | 用户自由命名 | |

**User's choice:** `blog_inline`  
**Notes:** 博客正文图与其他人工资源要分开统计和审计。

### 封面类命名粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 少量通用业务名 | 保持清晰，但不把字典拆到每个模型一个 purpose | ✓ |
| 全部并成 `cover` | 简化字典，但丢失审计粒度 | |
| 全部按业务对象细拆 | 粒度最细，但更容易漂移 | |
| 其他 | 用户自定义命名集合 | |

**User's choice:** 少量通用业务名  
**Notes:** 用户要避免字典膨胀，同时保留基本可审计性。

### 历史/旁路上传面的 Phase 8 边界

| Option | Description | Selected |
|--------|-------------|----------|
| 先收紧 `/api/upload` 和 crawler 主链路 | 历史旁路只要求不能绕过成本边界 | ✓ |
| Phase 8 全面统一所有上传路径 | 一次性把 presign/脚本/helper 全统一 | |
| 只限制 `/api/upload` | 不处理 crawler/presign 旁路 | |
| 其他 | 用户自定义边界 | |

**User's choice:** 先收紧 `/api/upload` 和 crawler 主链路  
**Notes:** 全量统一被明确后延到 Phase 10。

---

## 生命周期保留窗口

### 四类 prefix 的默认保留窗口

| Option | Description | Selected |
|--------|-------------|----------|
| 偏保守 | 7 / 7 / 14 / 30 天 | |
| 更激进省钱 | 3 / 3 / 7 / 14 天 | ✓ |
| 更保守运维 | 14 / 14 / 30 / 90 天 | |
| 自定义 | 用户自定义天数 | |

**User's choice:** 更激进省钱  
**Notes:** 最终窗口锁为 `tmp/` 3 天、`crawler-debug/` 3 天、`import-staging/` 7 天、`mappings/backups/` 14 天。

### `mappings/backups/` 数量护栏

| Option | Description | Selected |
|--------|-------------|----------|
| 14 天 + 最近 20 份 | 时间和数量双保险 | ✓ |
| 14 天 + 最近 10 份 | 更省钱但回看更短 | |
| 只按 14 天 TTL | 不做数量控制 | |
| 其他 | 用户自定义规则 | |

**User's choice:** 14 天 + 最近 20 份  
**Notes:** 用户明确要 count guard，避免高频小文件在 TTL 窗口内堆积。

### 落地力度

| Option | Description | Selected |
|--------|-------------|----------|
| 临时前缀自动过期 + mapping backup 审计/清理护栏 | 把时间窗口变成实际执行目标 | ✓ |
| 只写 runbook 指南 | 不形成执行护栏 | |
| 四类都作为实际执行护栏 | 全部强执行 | |
| 其他 | 用户自定义 | |

**User's choice:** 临时前缀自动过期 + mapping backup 审计/清理护栏  
**Notes:** `tmp/`、`crawler-debug/`、`import-staging/` 需成为明确自动过期目标；`mappings/backups/` 走时间+数量护栏。

---

## 成本审计与预算提醒阈值

### 审计硬失败集合

| Option | Description | Selected |
|--------|-------------|----------|
| 硬失败集合 | 对越界 prefix、过期对象、backup 越窗/超份数明确判失败 | ✓ |
| 更严格 | 额外把 `system/` 未分类增长算失败 | |
| 更宽松 | 只对 `images/` / chapter prefix 判失败 | |
| 其他 | 用户自定义集合 | |

**User's choice:** 硬失败集合  
**Notes:** `system/` 与 `ops/d1-backups/` 仍保留为审计项，但本 phase 不自动判硬失败。

### Budget Alerts 阈值

| Option | Description | Selected |
|--------|-------------|----------|
| `$1` / `$3` | 低成本双阈值提醒 | ✓ |
| `$0.5` / `$1` | 更紧的提醒阈值 | |
| `$2` / `$5` | 更宽的提醒阈值 | |
| 自定义 | 用户自定义金额 | |

**User's choice:** `$1` / `$3`  
**Notes:** 用户同时认可在 `RUNBOOK` 中明确写死“Budget Alerts 只提醒，不封顶”。

### 审计执行节奏

| Option | Description | Selected |
|--------|-------------|----------|
| 手动主导 + 关键变更前强制 | 平时按需手动，关键变更前必须审计 | ✓ |
| 固定周期 + 手动补跑 | 周期审计为主 | |
| 只在怀疑有问题时手动跑 | 最低执行频率 | |
| 其他 | 用户自定义节奏 | |

**User's choice:** 手动主导 + 关键变更前强制  
**Notes:** 关键场景明确包括存储策略改动、cleanup、migration、批量导入。

### 审计证据不完整时的处理

| Option | Description | Selected |
|--------|-------------|----------|
| 一律阻断 | cleanup / 删除 / lifecycle 变更都不能继续 | ✓ |
| 只阻断删除类动作 | 文档和部分 guard 可继续 | |
| 只记告警 | 不作为阻断条件 | |
| 其他 | 用户自定义阻断规则 | |

**User's choice:** 一律阻断  
**Notes:** 用户明确要求“没有完整审计证据，只能继续读、看、记，不能执行实际清理动作”。

---

## the agent's Discretion

- 规划阶段可细化最终 purpose 名称，但必须保持“窄口径、业务化、内部前缀不暴露”的形状。
- 历史 presign / comic cover 旁路可采用最小改动 guard，只要不绕过成本边界，并保持 Phase 10 再做彻底统一。
- lifecycle 的具体执行组合可在 R2 lifecycle 与脚本/运行手册护栏之间选择，但必须满足用户已锁定的时间/数量规则。

## Deferred Ideas

- 所有上传路径和 helper 的全面统一，留到 Phase 10。
- `system/` / `ops/d1-backups/` 更细的 operations retention/classification，留到后续 phase。
- 固定周期自动审计如果后续需要，再单独立项。
