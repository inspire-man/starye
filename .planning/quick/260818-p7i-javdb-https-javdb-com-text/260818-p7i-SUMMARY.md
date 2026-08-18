---
quick: 260818-p7i
status: complete
branch: main
verified: 2026-08-18
---

# JavDB canonical source switch

## Completed

- `JavDBStrategy.baseUrl` 已从旧镜像切换为 `https://javdb.com`。
- R18 tagging 回归测试改用 canonical 详情 URL，并增加 `baseUrl` 断言。
- 四份可读 JavDB fixture 的导航入口已同步；Cloudflare challenge 快照保留为历史响应，不参与运行时入口。

## Verification

- JavDB 定向测试：1 个文件、2 项通过。
- crawler 全量单测：28 个文件、160 项通过。
- crawler type-check：通过。
- `git diff --check`：通过。
- GitNexus staged detect：LOW，6 个文件仅触及 `JavDBStrategy`，无受影响执行流程。

## Scope

本 quick task 只提交 JavDB 来源切换、相关测试/fixture 和 GSD 记录；工作树中既有 API、播放器、认证及文档改动保持未暂存。
