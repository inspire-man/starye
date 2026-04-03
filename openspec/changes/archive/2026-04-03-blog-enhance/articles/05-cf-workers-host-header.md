---
title: Cloudflare Workers 互调陷阱：Host 头的隐藏坑
slug: ts-fullstack-ai-05-cf-workers-host-header
series: ts-fullstack-ai-chronicle
seriesOrder: 5
tags: ["cloudflare", "workers", "gateway", "http", "debugging"]
excerpt: Gateway Worker 转发请求给 API Worker，结果报 404 或死循环——罪魁祸首竟是一个被透传的 Host 请求头。
---

## 背景：Gateway 架构

Starye 的所有流量都通过一个 Gateway Worker 统一入口，再根据路径转发给各个子服务：

```
用户请求 starye.dev/api/posts
         ↓
     Gateway Worker
         ↓ fetch('https://api.starye.dev/posts')
     API Worker
```

Gateway 的核心逻辑很简单——根据 URL 前缀转发：

```typescript
// apps/gateway/src/index.ts
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    
    if (url.pathname.startsWith('/api/')) {
      return forwardTo(request, env.API_URL, url.pathname.replace('/api', ''))
    }
    // ...其他路由
  }
}
```

## 问题：404 或死循环

在本地开发时一切正常。部署到 Cloudflare 生产环境后，通过 Gateway 访问 API 的请求开始报 404，有时甚至陷入死循环（请求在 Workers 之间反复跳转，最终超时）。

直接访问 API Worker（`api.starye.dev/posts`）完全正常。

只有通过 Gateway 转发的请求有问题。

## 根因：Host 头被透传

问题出在 `forwardTo` 函数的实现：

```typescript
// ❌ 问题代码
async function forwardTo(request: Request, targetUrl: string, path: string) {
  const url = new URL(targetUrl + path)
  
  // 直接透传原始 request 的所有头部
  return fetch(url.toString(), {
    method: request.method,
    headers: request.headers, // ← 问题在这里！
    body: request.body,
  })
}
```

当用户请求 `starye.dev/api/posts` 时，请求的 `Host` 头是 `starye.dev`。

Gateway 把这个请求转发给 API Worker 时，**连 `Host: starye.dev` 一起转发了**。

API Worker 收到了目标地址是 `api.starye.dev` 的请求，但 `Host` 头写的是 `starye.dev`。Cloudflare 的路由逻辑会根据 `Host` 头来判断这个请求属于哪个 Zone（域名区域），结果把它路由回了 Gateway——造成死循环。

更糟的是，某些配置下 Cloudflare 直接返回 404，因为 `starye.dev` 这个 Zone 下并没有直接响应 `/api/posts` 的规则（那个规则在 API Worker 的 Zone 里）。

## 解决方案：删除 Host 头

修复极其简单——在转发前，删除原始请求的 `Host` 头，让 `fetch` 根据目标 URL 自动生成正确的 `Host`：

```typescript
// ✅ 修复代码
async function forwardTo(request: Request, targetUrl: string, path: string) {
  const url = new URL(targetUrl + path)
  url.search = new URL(request.url).search // 保留 query string

  // 复制请求头，但删除 Host
  const headers = new Headers(request.headers)
  headers.delete('host') // ← 关键修复

  return fetch(url.toString(), {
    method: request.method,
    headers,
    body: request.body,
    // redirect: 'follow' 是默认值，通常不需要显式设置
  })
}
```

删除 `Host` 头后，Cloudflare Workers 的 `fetch` 会根据你提供的目标 URL 自动填入正确的 `Host: api.starye.dev`，路由逻辑恢复正常。

## 为什么本地没有这个问题？

本地开发时，Gateway 和 API 都跑在 `localhost` 上（不同端口），不经过 Cloudflare 的 Zone 路由逻辑。

`localhost:3000/api/posts` → 转发到 `localhost:8787/posts`，两者都是 `localhost`，`Host` 头不影响路由。

所以这个 bug 只在生产环境出现，本地无法复现——这也是它特别难排查的原因。

## 还有哪些头部需要注意？

除了 `Host`，在 Workers 互调时还有几个请求头需要谨慎处理：

| 请求头 | 建议 | 原因 |
|--------|------|------|
| `Host` | 删除 | 让 fetch 自动填入，避免路由误导 |
| `CF-Connecting-IP` | 保留或替换 | 如果下游需要真实 IP |
| `X-Forwarded-For` | 谨慎处理 | 避免伪造客户端 IP |
| `Content-Length` | 让 fetch 重新计算 | body 变更后原值可能不准确 |
| `Transfer-Encoding` | 删除 | Workers 不支持 chunked encoding |

## 经验总结

### Checklist：Cloudflare Workers 请求转发

- [ ] **删除 `Host` 头**：转发前必须清除，让 `fetch` 重新生成
- [ ] **保留必要的认证头**：`Authorization`、`Cookie` 等需要透传
- [ ] **在生产环境测试**：本地无法复现 Zone 路由问题
- [ ] **使用 `new Headers(request.headers)` 复制**：创建可修改的副本

### 核心教训

> Cloudflare Workers 的 `fetch` 不是普通的 HTTP 客户端。  
> 它运行在 Cloudflare 的网络边缘，HTTP 头部会影响 Cloudflare 自身的路由逻辑。  
> 透传原始请求头，等于让下游请求「假冒」源请求的身份，后果不可预料。

这个坑让我排查了大半天。最终的修复只有一行代码：`headers.delete('host')`。  
文档里提到过这个注意事项，但不够显眼——希望这篇文章能帮你跳过这个坑。
