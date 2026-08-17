---
quick: 20260817-video-availability-actions
date: 2026-08-17
status: complete
---

# 视频来源检查与修复动作闭环

## Delivered

- 视频可用性命令收敛为 `idempotencyKey`、`movieId`、`reason` 三个最小字段；API 服务端读取当前 `movie_source_state.source_revision`，固定 `video-source-probe/v1`，返回 revision/policy binding。
- Dashboard 爬虫管理页与 Movie Detail 均接入真实 revision-bound recheck/repair 任务、统一确认弹窗、提交反馈和权威刷新；provider 配置异常只显示配置指引。
- Movie Detail 的过期层统一归一到 `stale`，展示态 reason 经过类型守卫后才进入 API 命令，避免将 provider 状态或 `available` 误提交。
- 补齐 API、Dashboard、Movie App 的 DTO、路由、API client、确认弹窗与 DOM 契约测试。

## Verification

- API 定向测试：5/5；Dashboard 定向测试：24/24；Movie App 定向测试：23/23。
- API type-check/build/lint、Dashboard type-check/lint/build、Movie App `vue-tsc`/定向 lint/build 均通过。
- `git diff --check` 通过；Dashboard/Movie App 使用仓库生成的本地 Pages runtime env 构建成功。
- `Deploy Auth Service` 修复回归：失败 Run `32000598524`，修复后成功 Run `32031867574`。

## Scope

本 quick task 未纳入用户已有的 `AGENTS.md`、`CLAUDE.md` 修改；未修改共享 `createOrGetActiveRun`，避免影响既有 schedule/retry/supersede 流程。
