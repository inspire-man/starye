# Starye Dashboard

后台管理系统，用于管理个人网站的内容、爬虫任务及系统设置。

## 技术栈

- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite 7
- **样式**: Tailwind CSS v4
- **组件库**: 基于 `@starye/ui` (Shadcn UI Vue)
- **路由**: Vue Router 4

## 目录结构

- `src/lib/api.ts`: API 客户端封装
- `src/views/`: 页面组件
- `src/components/`: 通用组件
- `src/layouts/`: 布局组件

## 开发环境

```bash
# 启动开发服务器
pnpm dev

# 构建项目
pnpm build
```

## 环境变量

- `VITE_API_URL`: 后端 API 地址，默认 `http://localhost:8787`
