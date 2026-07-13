# Starye

自用的个人内容中台，统一跑在 Cloudflare Workers + Pages + D1 + R2 上，包含 movie、comic、blog、dashboard、crawler、auth 和 gateway。

## 当前里程碑

**v1.1: 存储成本控制与代码/文件整理**

- 目标：把漫画章节正文图片留在 source/external URL，R2 只保留必要资产，并把文档入口收敛到清晰的 canonical owner。
- 当前状态：Phase 6-8 已完成；Phase 9 文档重构本次执行；Phase 10 将继续做 storage helper/code cleanup。

## 本地快速启动

```bash
pnpm install
cp .env.example .env.local
pnpm dev:clean
```

本地访问必须统一走 Gateway：

- `http://localhost:8080/dashboard/`
- `http://localhost:8080/blog/`
- `http://localhost:8080/movie/`
- `http://localhost:8080/comic/`
- `http://localhost:8080/auth/`

不要把 `3000/3001/3002/3003/5173` 端口当成标准入口。

## 去哪读什么

| Topic | Canonical Owner | Use When |
|-------|-----------------|----------|
| 项目定位、里程碑目标、关键决策 | [`.planning/PROJECT.md`](./.planning/PROJECT.md) | 想知道这个仓库现在为什么做、做到哪一步 |
| 当前 phase / roadmap / 下一步命令 | [`.planning/ROADMAP.md`](./.planning/ROADMAP.md), [`.planning/STATE.md`](./.planning/STATE.md) | 想继续当前里程碑工作 |
| 文档 owner 边界、live docs vs archive docs | [`docs/documentation-ownership.md`](./docs/documentation-ownership.md) | 不确定某类信息应该更新哪份文档 |
| 生产运维、rollback、D1、R2 cleanup | [`RUNBOOK.md`](./RUNBOOK.md) | 部署、回滚、存储规则、事故处理 |
| Agent 协作规则 | [`AGENTS.md`](./AGENTS.md) | 需要按仓库约束执行开发/排障/提交流程 |
| 规格与变更历史 | [`openspec/`](./openspec/) | 查长期 spec / change proposal |

## 仓库组成

- `apps/`：可部署应用（api、gateway、dashboard、movie-app、comic-app、blog、auth）
- `packages/`：共享包（db、ui、crawler、api-types、config、locales）
- `.planning/`：当前 milestone / phase 真相和历史执行证据
- `docs/`：稳定专题文档；历史材料在 `docs/archive/`
- `openspec/`：spec 与 change proposal 历史

更多 owner 细节见 [`docs/documentation-ownership.md`](./docs/documentation-ownership.md)。
