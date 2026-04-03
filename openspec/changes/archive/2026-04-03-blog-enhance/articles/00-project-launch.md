---
title: 用 AI 辅助构建个人技术全栈：项目启动日志
slug: ts-fullstack-ai-00-project-launch
series: ts-fullstack-ai-chronicle
seriesOrder: 0
tags: ["typescript", "cloudflare", "nuxt", "monorepo", "ai"]
excerpt: 我是如何用 AI 辅助，在 Cloudflare 免费套餐上构建一个完整的个人技术全栈的？本文记录项目从零启动的架构决策过程。
---

## 背景：为什么要从零开始

市面上博客框架、个人网站模板随处可见，但我选择自己从零构建——原因有三：

1. **学习驱动**：真实项目是最好的学习场景，边做边踩坑比教程学得快 10 倍
2. **技术栈实验场**：我想在自己的地盘上验证最新的工具链（Hono、Drizzle ORM、Nuxt 4、Cloudflare Workers）
3. **AI 协作实验**：探索 AI 辅助开发的边界——哪些环节 AI 真的能帮上忙，哪些还需要人工把关

于是，**Starye** 项目诞生了。

## 核心约束：Cloudflare Free Tier

在规划之初，我给自己设定了一条铁律：**项目运营成本为零**。这直接决定了技术选型：

| 服务 | 选型 | 免费额度 |
|------|------|---------|
| 计算 | Cloudflare Workers | 10 万次请求/天 |
| 数据库 | D1 (SQLite) | 5GB 存储，2500 万行读取/天 |
| 对象存储 | R2 | 10GB 存储，100 万次 Class A 操作/月 |
| 前端 | Cloudflare Pages | 无限静态部署 |
| CI/CD | GitHub Actions | 2000 分钟/月 |

这套组合完全在 Free Tier 范围内，意味着不管流量多少，基础成本始终为零。

## 架构决策：路由级微前端

最终选择了「**路由级微前端 + 多应用独立部署**」的架构：

```
用户访问 starye.dev
       ↓
  Gateway (CF Worker)
  ├── /blog  → blog (Nuxt 4 on CF Pages)
  ├── /movie → movie-app (Vue3+Vite on CF Pages)
  ├── /comic → comic-app (Vue3+Vite on CF Pages)
  ├── /auth  → auth (Nuxt 4 on CF Pages)
  ├── /dashboard → dashboard (Vue3+Vite on CF Pages)
  └── /api   → api (Hono on CF Workers)
```

每个子应用独立部署、独立维护，通过 Gateway Worker 统一路由。

**为什么不用单体？**  
Cloudflare Pages 对每个项目提供独立的部署流水线。拆分后，修改博客不会触发漫画应用重新部署，开发迭代更聚焦。

**为什么不用 Next.js 全栈？**  
Cloudflare Workers 运行时不是完整的 Node.js 环境——没有文件系统、没有 `node:crypto` 等内置模块。Next.js 的某些特性在这个环境下无法开箱即用。Nuxt 4 的 `cloudflare-pages` preset 则针对这个平台专门优化过。

## Monorepo 结构：pnpm + Turborepo

所有应用和包共享一个代码仓库：

```
starye/
├── apps/
│   ├── api/           # Hono API (Workers)
│   ├── blog/          # Nuxt 4 博客
│   ├── movie-app/     # Vue3 电影库
│   ├── comic-app/     # Vue3 漫画库
│   ├── auth/          # Nuxt 4 鉴权应用
│   ├── dashboard/     # Vue3 管理后台
│   └── gateway/       # CF Worker 网关
└── packages/
    ├── db/            # Drizzle Schema + 迁移
    ├── ui/            # 共享组件库
    ├── locales/       # 多语言翻译包
    └── crawler/       # 爬虫逻辑 (Node.js, 仅在 CI 运行)
```

`pnpm workspace` 管理包依赖，`turborepo` 提供增量构建缓存。在这套结构里，`packages/db` 是数据层的单一事实来源——无论 API 还是后台，都从这里 import Schema 和类型定义。

## AI 的角色：副驾驶而非自动驾驶

在整个开发过程中，AI 扮演了「副驾驶」的角色：

- **脚手架生成**：初始文件结构、Drizzle Schema 骨架、路由模板，AI 给出初稿，人工审查后采纳
- **错误排查**：遇到 Cloudflare 特有的报错，AI 能快速识别模式并给出针对性建议
- **文档翻译**：面对英文官方文档，AI 能准确提炼关键配置项
- **代码审查**：将改动贴给 AI 做快速 review，发现潜在的类型错误或边界案例

**AI 做不好的地方：**
- 具体的 Cloudflare 平台配置细节（经常给出过时的 API 写法）
- 跨服务的集成调试（需要在本地真实运行才能发现问题）
- 架构层面的决策（需要结合个人偏好和长期维护成本综合判断）

## 下一步

这个系列将记录开发过程中遇到的真实问题和解决方案。后续文章包括：

- D1 数据库迁移的隐藏陷阱
- 如何写出可测试的爬虫代码
- Cloudflare Workers 之间互调的坑

如果你也在用类似的技术栈，希望这些经历能帮到你。
