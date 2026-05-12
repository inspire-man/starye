---
phase: 3
slug: movie-app-r2
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for movie-app playback stabilization after Phase 3 scope reduction.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 |
| **Config file** | `apps/movie-app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @starye/movie-app test --run` |
| **E2E framework** | Playwright |
| **E2E config** | `apps/movie-app/playwright.config.ts` |
| **Estimated runtime** | unit ~10-20s; e2e / integration depends on local services |

## Sampling Rate

- **After every task commit:** Run the narrowest affected movie-app unit tests first.
- **After every plan wave:** Run `pnpm --filter @starye/movie-app test --run`.
- **Before `/gsd-verify-work`:** Unit suite green + human playback checklist executed.
- **Max feedback latency:** < 30s for unit checks; human playback verification may exceed.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure / Stable Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------------------|-----------|-------------------|-------------|--------|
| V-03-01 | 03-01 | 0 | VIDEO-04, VIDEO-05 | 文档已与实际范围一致，不再把 R2 / 签名 URL 作为 v1 缺口 | grep / review | `rg -n "VIDEO-0[1-6]|cdn.starye.org|签名|R2" .planning/REQUIREMENTS.md .planning/ROADMAP.md .planning/PROJECT.md .planning/STATE.md` | ✅ | ✅ passed |
| V-03-02A | 03-02 | 1 | VIDEO-04, VIDEO-05 | Player 所有主要错误路径都显示统一错误卡片，不黑屏卡死 | human + targeted unit | `pnpm --filter @starye/movie-app test --run` | ✅ | ✅ automated pass, human pending |
| V-03-02B | 03-02 | 1 | VIDEO-04 | 重试行为只重试同源，不自动切源、不做 codec swap | unit / manual | `pnpm --filter @starye/movie-app exec vue-tsc --noEmit` | ✅ | ✅ automated pass, human pending |
| V-03-03 | 03-03 | 2 | VIDEO-05 | Aria2 / TorrServer 离线时按钮可见、disabled、title 提示明确 | unit / DOM | `pnpm --filter @starye/movie-app test --run` | ✅ | ✅ automated pass, human pending |
| TBD | 03-04 | 3 | VIDEO-04, VIDEO-05 | 真实播放、错误、重试、离线反馈已人工确认 | human | 见 `03-HUMAN-UAT.md` | ❌ | ⬜ pending |

## Wave 0 Requirements

- [x] 生成并通过文档收敛检查：REQUIREMENTS / ROADMAP / PROJECT / STATE
- [x] 明确 Player 级自动化只覆盖“轻逻辑”，不强行要求完整媒体仿真
- [x] 新建 Human UAT 文档覆盖真实播放错误路径

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 外链播放 / TorrServer 播放真实黑屏或错误态是否被统一卡片接住 | VIDEO-04, VIDEO-05 | 依赖真实浏览器媒体栈与真实流源 | 见 `03-HUMAN-UAT.md` Step 2/3/4 |
| 重试是否保留上次位置且不自动切源 | VIDEO-04 | 需观察真实播放器 seek 与 UI | 见 `03-HUMAN-UAT.md` Step 4 |
| Aria2 / TorrServer 离线按钮是否 disabled + title | VIDEO-05 | 需真实切断配置或服务 | 见 `03-HUMAN-UAT.md` Step 1 |

## Validation Sign-Off

- [x] 所有 plan 都有 automated verify 或明确的人工 gate
- [ ] Player 行为的关键成功条件被 human UAT 覆盖
- [x] 文档收敛已完成，不再存在已废弃的 VIDEO-01/02/03/06 v1 active 断言
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** automated checks passed; human playback UAT pending
