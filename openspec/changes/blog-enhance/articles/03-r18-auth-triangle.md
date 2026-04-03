---
title: R18 鉴权三角难题：Session、Cookie 与 Nuxt SSR
slug: ts-fullstack-ai-03-r18-auth-triangle
series: ts-fullstack-ai-chronicle
seriesOrder: 3
tags: ["nuxt", "better-auth", "ssr", "cookie", "session", "cloudflare"]
excerpt: 后台开启了用户 R18 权限，但前端封面还是被屏蔽——原来是 Session 回调、跨域 Cookie、SSR 服务端请求三个地方同时出了问题。
---

## 问题现象

操作流程很简单：在 Dashboard 给某个用户开启 R18 权限，理论上该用户刷新漫画页面后就能看到封面图。

但实际结果：**刷新后封面依然被屏蔽**，就好像权限从未变更。

更诡异的是，退出登录再重新登录之后，R18 内容正确显示了。

这说明问题不在权限写入，而在**权限读取链路**上某个环节没有正确更新 Session 状态。

## 根因分析：三个问题同时存在

排查下来发现，这是三个独立问题叠加的结果：

### 问题 1：better-auth Session 回调未透传 isAdult 字段

better-auth 默认的 Session 回调只包含基础用户字段（id、email、name 等）。我自定义的 `isAdult` 字段没有配置透传，导致前端收到的 Session 对象里根本没有这个字段。

**修复：**

```typescript
// apps/api/src/lib/auth.ts
export function createAuth(env: Env, request: Request) {
  return betterAuth({
    // ...其他配置...
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24, // 24 小时
      },
    },
    // ✅ 显式透传自定义字段
    user: {
      additionalFields: {
        isAdult: {
          type: 'boolean',
          defaultValue: false,
        },
        isR18Verified: {
          type: 'boolean',
          defaultValue: false,
        },
      },
    },
  })
}
```

### 问题 2：前端跨域请求未携带 Cookie

Nuxt 应用部署在 `starye.dev/comic`，API 在 `starye.dev/api`（通过 Gateway 转发）。即使是同域，`useFetch` 默认不携带 Cookie：

```typescript
// ❌ 默认不携带 Cookie
const { data } = await useFetch('/api/user/session')

// ✅ 需要显式指定
const { data } = await useFetch('/api/user/session', {
  credentials: 'include',
})
```

这导致 API 收不到 Session Cookie，无法识别用户身份，只能返回未登录状态。

### 问题 3：SSR 服务端请求未转发客户端 Cookie

这是最隐蔽的一个。Nuxt SSR 在服务端运行时，`useFetch` 是在 Node.js（或 Cloudflare Workers）环境中执行的，**不是在浏览器中**。

这意味着：即使你配置了 `credentials: 'include'`，SSR 服务端也没有客户端的 Cookie——因为 Cookie 在浏览器里，不在服务端。

用户的 Cookie 随 HTTP 请求发到了 Nuxt 服务端，但没有被转发给 API。

```typescript
// ❌ SSR 时服务端没有 Cookie
const { data } = await useFetch('/api/posts', {
  credentials: 'include',
})

// ✅ SSR 时手动转发客户端 Cookie
const { data } = await useFetch('/api/posts', {
  credentials: 'include',
  headers: useRequestHeaders(['cookie']), // 从 SSR 请求头中提取 cookie 并转发
})
```

`useRequestHeaders(['cookie'])` 是 Nuxt 提供的 composable，它在 SSR 阶段从当前 HTTP 请求中提取指定请求头，让你可以「代理转发」给下游 API。

## 三个修复的叠加效果

单独修任何一个都不足以解决问题：

| 修复项 | 解决的问题 |
|--------|-----------|
| Session 回调透传 isAdult | 确保 Session 对象包含权限字段 |
| `credentials: 'include'` | 确保浏览器端请求携带 Cookie |
| `useRequestHeaders(['cookie'])` | 确保 SSR 端请求携带 Cookie |

三者必须同时到位，才能让权限链路完整工作。

## 一个额外的坑：Session 缓存

修复后，权限更新还是有延迟——后台改了权限，前端不退出登录的话要等一段时间才能感知到。

这是 better-auth 的 `cookieCache` 在起作用：Session 信息会被缓存在 Cookie 中一段时间，避免每次请求都查询数据库。

**权衡：**
- 启用缓存：减少 D1 查询次数，性能更好，但权限更新有延迟
- 禁用缓存：权限即时生效，但每次请求都需要查询数据库

对于个人项目，我选择保留缓存（24 小时），因为 R18 权限变更是低频操作，偶尔重新登录即可刷新 Session。

## 经验总结

### Checklist：Nuxt SSR + better-auth 鉴权集成

- [ ] **检查 Session 字段**：确认自定义字段在 `additionalFields` 中正确声明
- [ ] **客户端 fetch**：统一加 `credentials: 'include'`
- [ ] **SSR 端 fetch**：统一加 `headers: useRequestHeaders(['cookie'])`
- [ ] **测试跨域场景**：不要只在本地 localhost 测，要模拟真实的跨域/跨路径场景
- [ ] **考虑 Session 缓存时间**：权限敏感的字段设置合理的缓存过期时间

### 核心教训

> SSR 不是魔法——服务端没有浏览器的 Cookie 存储。  
> 用户的 Cookie 是随 HTTP 请求到达服务端的请求头里，你需要手动提取并转发。

这个「三角难题」（Session 字段 → Cookie 携带 → SSR 转发）是 Nuxt + 自定义鉴权系统集成时的常见踩坑区。把这个 Checklist 贴在项目 README 里，能省下不少排查时间。
