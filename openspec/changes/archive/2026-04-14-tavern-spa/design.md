## Context

针对 `Tavern SPA` 这一特性，经过方案重审，我们决定进行一次战略“轴转”(Pivot)。将原先的「全栈前端研发」任务，切换成了「现有服务的基础设施集成」任务。SillyTavern 因为其前端成熟度，成为了该业务域最佳现成解。

## Goals / Non-Goals

**Goals:**
1. 将本地部署的 SillyTavern UI 安全地曝露于公网，或反代在统一内网网关。
2. 在 Starye Dashboard (`apps/dashboard`) 添加快捷跳转或 iframe 嵌套，统揽全局业务。
3. 弃用对 `apps/tavern` 和 `apps/api` 的相关变更，实现零代码业务搭建。

**Non-Goals:**
1. 重写或开发任何形式的 Vue AI Chat 前端。
2. 为 SillyTavern 自己实现额外的 OAuth (依赖 Cloudflare Access 即可)。
3. 为这套子系统单独占用 D1 数据库资源。

## Decisions

### 1. 摒弃自研，直接拥抱开源
放弃开发 `apps/tavern` SPA。本地机器保持运行 `node server.js` (启动 SillyTavern)。带来的绝对优势包括但不限于内置的大量微调选项、强大的预设 (Presets)、世界书、Lorebook 等。

### 2. 网络穿透与 Auth 层分离
通过 Cloudflare Zero Trust 替代应用层鉴权：
- 安装 `cloudflared` 守护进程。
- 配置 Public Hostname 将 `tavern.xxx.com` 映射为 `http://localhost:8000`。
- 在 Cloudflare Access 里新建 Application，将策略(Policies) 设为 Require Login (如通过 GitHub 或 Email One-Time Pin)。
此时你的 SillyTavern 完全不设防(不需要设置本体密码)，因为安全网门控已经在 Cloudflare 边缘节点卡死了。

### 3. 统一台面 (Dashboard Iframe)
为了让 Starye 对各类子应用维持一致的入口概念：
- 我们将在 `apps/dashboard/src/router/routes.ts` 里加一个名为 `Tavern` 的菜单。
- 用户可选择在新标签页打开，或通过简单的 Iframe URL 配置在 Content 区域无边界渲染。

## Risks / Trade-offs

- **[Risk] SillyTavern 主机必须常驻开启** →
  - **Mitigation:** 如果需要公网使用，必须保障本地主机(或者 NAS) 全天候运行。相比原方案 (Serverless前端 + 云端API + D1数据库)，抗灾备能力略弱（停电就失效），但作为个人应用依然非常合适。
- **[Risk] iframe 被拦截 (X-Frame-Options)** →
  - **Mitigation:** SillyTavern 自身默认不支持被跨域 iframe 嵌套等。目前我们拥有隧道的完全掌控权，如果需要 iframe 结合，则只能在 Starye Dashboard 纯外链跳转为佳（跳出即跳出，省心）。

## Migration Plan
1. 清除原先为 `tavern-spa` 创建的 `specs/` 包。
2. 配置 `cloudflared` 与 Cloudflare Access。
3. 修改 Dashboard 代码后提交。
