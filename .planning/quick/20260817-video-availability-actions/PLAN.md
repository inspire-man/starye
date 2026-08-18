---
slug: video-availability-actions
status: in-progress
---

# Video availability actions

让影片详情页与爬虫管理页能够提交 revision-bound 视频来源检查/修复任务。请求只提交目标、幂等键和原因；服务端从当前 movie source state 读取 source revision，并固定 canonical video probe policy。提交后两个页面分别刷新权威详情或聚焦新任务，保留已有历史事实。

## Verification

- API video availability route tests
- Dashboard crawler tests and type-check
- Movie App API-client/MovieDetail tests and type-check
- API types build, lint, `git diff --check`, GitNexus detect-changes
