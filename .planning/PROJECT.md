# Starye — 个人内容中台

## 定位

自用内容中台，统一承载视频、漫画、博客、后台运管、爬虫、认证、网关和 API。核心价值：部署在公网后能稳定访问、阅读、观看；单用户、低成本优先。

## 当前状态

最新完成里程碑：**v1.5 爬虫运管与内容可用性闭环**，2026-08-22 完成归档与部署。

- 22/22 requirements、4/4 phases、23/23 plans 通过。
- 生产 SHA：`184e2941863a30640536aa97c35e798f84cf5144`。
- 生产 Manga Crawl：workflow `32536822682`，D1 run `9ee3320b-4726-4b3a-9d51-a2c6de9c972d`。
- 章节 `790-34389`：25/25 页面 observation 为 `available`；同源图片在浏览器解码成功。
- Reader 的生产匿名浏览受 R18 登录态限制；完整 Reader tuple 保留在 v1.5 Phase 28 验证归档。

当前没有进行中的里程碑。新需求从 [`openspec/README.md`](../openspec/README.md) 建立 change；小 bug 直接走代码、测试、Gateway 验证。

## 稳定约束

- 技术栈：Turborepo + pnpm + TypeScript；Workers/Pages + Hono + Vue/Nuxt；D1/R2/KV + Drizzle + Better Auth。
- 本地浏览器入口统一为 `http://localhost:8080/...`；应用端口只用于诊断。
- D1 是 crawler task/run/attempt、receipt 和 projection 的权威读回源。
- crawler 运行状态、元数据、transport、content integrity、repair receipt 和实际 playback/reading 分层验证。
- 修复/复查必须 revision-bound、幂等、CAS 保护，并以同内容 authoritative readback 后才能接受。
- 漫画正文图片默认保存源站 URL；R2 只保存必要资产，不做正文图长期代理或批量存储。
- 生产 crawler/browser 由 GitHub Actions 执行；Worker 负责鉴权、调度边界、回调和 readback。
- 单用户项目，不做多租户、计费、实时协作和原生移动端。

## 文档与历史

- 当前执行状态：[`STATE.md`](./STATE.md)
- 里程碑路线：[`ROADMAP.md`](./ROADMAP.md)
- v1.5 完整证据：[`milestones/v1.5-MILESTONE-AUDIT.md`](./milestones/v1.5-MILESTONE-AUDIT.md)
- 更早里程碑：[`milestones/`](./milestones/)
- 稳定运维规则：[`../RUNBOOK.md`](../RUNBOOK.md)

不要为历史 phase 重新读取整套计划；只有任务明确涉及某项历史证据时才打开对应文件。
