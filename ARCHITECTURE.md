# Starye Architecture

本文件是项目架构的稳定顶层地图。实现细节、阶段证据和历史分析保留在链接的专属 owner 中。

## 系统形态

Starye 是一个基于 pnpm/Turborepo 的 TypeScript monorepo，部署在 Cloudflare Workers/Pages，并使用 Gateway 统一暴露多个应用。D1 是业务数据的权威持久化层，R2 用于受控资产和运维留痕，KV 用于 Gateway 缓存。

## 可部署表面

| 表面 | 目录 | 责任 |
|------|------|------|
| Gateway | apps/gateway | 统一入口、路径路由、缓存和跨应用边界 |
| API | apps/api | Hono 路由、鉴权、业务服务、OpenAPI 和 D1 访问 |
| Dashboard | apps/dashboard | 内容、爬虫和运维管理 |
| Movie | apps/movie-app | 影片浏览、播放、收藏和下载 |
| Comic | apps/comic-app | 漫画浏览、阅读和进度 |
| Blog | apps/blog | Nuxt 博客内容 |
| Auth | apps/auth | 登录和认证入口 |
| Quant | apps/quant-app | 受保护的量化研究工作台 |

## 共享包

- packages/db：Drizzle schema、D1 client 和 migrations。
- packages/ui：跨应用 Vue 组件和设计令牌。
- packages/api-types：API 类型和客户端契约。
- packages/config：目标 profile、部署输入、preflight 和证据边界。
- packages/crawler：外部数据采集、解析、内容可用性和运行器。
- packages/locales：共享多语言资源。

## 关键数据流

1. 浏览器请求先进入 Gateway，再按路径转发到对应应用或 API。
2. API 在边界处解析请求形状，经 middleware 和 service 访问 D1/R2/KV。
3. Crawler 由 GitHub Actions 运行，通过受控 API 写入数据；task、run、attempt、receipt 和 projection 分层保存。
4. Quant 研究从当前用户观察池读取数据，保留原始证据、来源、时间和数据缺口，不把缺失数据伪装成结论。

## 不变量

- 本地浏览器验收统一使用 http://localhost:8080；应用端口只用于诊断。
- 跨 API、数据库、Crawler 和前端的功能必须保留可追踪的契约和 authoritative readback。
- 远程 mutation 必须经过显式 target、preflight 和对应的验证 tuple。
- Secret、cookie、JWT、认证 header 和原始回调 payload 不进入版本化文档或证据。
- 代码层级和依赖方向由结构测试、lint、类型检查和定向测试持续验证。

## 继续阅读

- 稳定工程原则和 agent 入口：AGENTS.md
- 开发、部署和运行边界：README.md、RUNBOOK.md
- 设计与规格索引：docs/DESIGN.md、docs/PLANS.md
- 当前阶段状态：.planning/STATE.md
- API、数据模型和前端契约：openspec/README.md 与 openspec/
- GitNexus 生成的详细快照：.planning/codebase/ARCHITECTURE.md
