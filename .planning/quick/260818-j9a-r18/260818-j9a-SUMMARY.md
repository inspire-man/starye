---
quick: 260818-j9a-r18
status: complete
branch: main
verified: 2026-08-18
---

# 影片详情 R18 受限态访问引导

## 已完成

- 修正 `userStore` 初始化顺序，消除 MovieDetail lint 的 `no-use-before-define` 失败。
- SFW 账号在详情页只看到“管理访问状态”，播放、选源和来源检查动作均按访问边界隐藏。
- 技术来源详情收敛为访问状态说明，不暴露 `eligible count`、revision、provider 或来源历史等内部信息。
- 来源卡片增加受限态渲染边界，服务端意外返回播放器数据时仍保持来源隐藏。
- 保留普通账号的播放、来源检查、修复和技术详情路径。

## 变更范围

- `apps/movie-app/src/views/MovieDetail.vue`
- `apps/movie-app/src/views/__tests__/MovieDetail.dom-contract.test.ts`
- `.planning/quick/260818-j9a-r18/`

用户已有的 `AGENTS.md`、`CLAUDE.md` 修改未纳入本 quick task 提交。
