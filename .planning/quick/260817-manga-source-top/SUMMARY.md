---
quick: 260817-manga-source-top
date: 2026-08-17
status: complete
---

# 更换漫画爬虫来源

## Delivered

- 漫画入口切换为 `https://www.92hm.top`，保留 `.life`、`.net` 历史链接识别兼容。
- 统一 `Site92Hm` 与漫画 task adapter 的入口常量，补充 `.top` 详情页、章节页和图片 URL 回归覆盖。
- 修正爬虫任务详情的模板边界：漫画 receipt 不再套用视频 `Source readiness`，Dashboard 不再将成功漫画任务显示为 `source_failed` 或“状态读取中”。
- 生产 Dashboard 中的旧活动/失败记录已清空；本次复测创建了全新的漫画任务。

## Verification

- crawler 定向测试：4 个文件、6 个测试通过。
- `pnpm --filter @starye/crawler type-check`：通过。
- API crawler task route：28/28 通过。
- Dashboard Crawlers：24/24 通过。
- `pnpm --filter api type-check`、`pnpm --filter dashboard type-check`：通过。
- `git diff --check`：通过。
- GitNexus impact：`projectReadiness` LOW；detect-changes：low risk、无额外执行流。
- 源站实测：`https://www.92hm.top/book/1012` 返回 200 并解析 88 个章节；章节页图片与下一章链接正常。
- 生产复测：GitHub Actions [32001485318](https://github.com/inspire-man/starye/actions/runs/32001485318) 使用提交 `2375da7` 成功，`resolve-target` 与 `crawl` 全部成功，“selected manga entry”通过，耗时 7 分 37 秒；Dashboard 已持久化内容 `1012`。

## Final production readback

- Follow-up 提交 `2fc7dc8` 已由 `Deploy API 32002984322` 与 `Deploy Dashboard 32002982888` 发布成功。
- 同一生产任务 `f9fcab14-e766-48d1-9ef9-10a43857ea75` 详情已读回：任务完成、Provider `completed / success`、内容 `1012`，不再显示 `Source readiness`、`source_failed` 或“状态读取中”。
