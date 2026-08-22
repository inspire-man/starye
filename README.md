# Starye

个人内容中台，包含 movie、comic、blog、dashboard、crawler、auth、gateway 和 api，部署在 Cloudflare Workers/Pages + D1/R2/KV。

## 当前状态

v1.5「爬虫运管与内容可用性闭环」已于 2026-08-22 完成并部署。当前没有进行中的里程碑，下一项需求直接从 OpenSpec change 开始。

已交付：crawler task/run/attempt 控制面、视频与磁链可用性、漫画章节/页面可用性、revision/CAS、receipt/readback、Dashboard 投影和 Gateway 验收。

## 本地启动

```bash
pnpm install
cp .env.example .env.local
pnpm dev:clean
```

浏览器验证统一走 Gateway：

- `http://localhost:8080/dashboard/`
- `http://localhost:8080/blog/`
- `http://localhost:8080/movie/`
- `http://localhost:8080/comic/`
- `http://localhost:8080/auth/`

其他应用端口只用于诊断。

## 迭代入口

1. 先读 [`.planning/STATE.md`](./.planning/STATE.md)；涉及背景或历史决策时再读 [`.planning/PROJECT.md`](./.planning/PROJECT.md)。
2. 单文件 bug 或小改动直接实现并补验证；跨 api/db/frontend、接口契约或多步骤功能先按 [`openspec/README.md`](./openspec/README.md) 建 change。
3. 修改代码前按 [GitNexus 规则](./AGENTS.md) 做影响分析；爬虫、持久化和前端验收遵循 Gateway/D1 规则。
4. 完成后只更新对应 canonical owner，不复制说明到多个文档。

## 文档地图

| 内容 | 入口 |
|------|------|
| Agent 规则 | [`AGENTS.md`](./AGENTS.md) |
| Claude 兼容入口 | [`CLAUDE.md`](./CLAUDE.md) |
| 当前状态与下一步 | [`.planning/STATE.md`](./.planning/STATE.md) |
| 项目背景与稳定决策 | [`.planning/PROJECT.md`](./.planning/PROJECT.md) |
| Roadmap 与已交付里程碑 | [`.planning/ROADMAP.md`](./.planning/ROADMAP.md) |
| 部署、回滚、D1、R2 | [`RUNBOOK.md`](./RUNBOOK.md) |
| 文档归属 | [`docs/documentation-ownership.md`](./docs/documentation-ownership.md) |
| OpenSpec 使用、spec 与 change | [`openspec/README.md`](./openspec/README.md) |
| 历史证据 | [`.planning/milestones/`](./.planning/milestones/)、[`docs/archive/`](./docs/archive/)、[`openspec/changes/archive/`](./openspec/changes/archive/) |

## 目录

- `apps/`：api、gateway、dashboard、movie-app、comic-app、blog、auth
- `packages/`：db、ui、crawler、api-types、config、locales
- `.planning/`：当前状态与历史验收证据
- `openspec/`：长期 spec 与变更记录
