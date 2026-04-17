/**
 * Cloudflare Gateway Worker
 *
 * Routes traffic to different services based on path.
 * In development: Uses localhost ports.
 * In production: Uses environment variable origins.
 */

import { createCachedProxy } from './cache-middleware'

interface Env {
  API_ORIGIN?: string
  DASHBOARD_ORIGIN?: string
  BLOG_ORIGIN?: string
  MOVIE_ORIGIN?: string
  COMIC_ORIGIN?: string
  TAVERN_ORIGIN?: string
  AUTH_ORIGIN?: string
  CACHE?: KVNamespace
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // 创建带缓存的代理函数
    const cachedProxy = createCachedProxy(env.CACHE, proxy)

    // Detect local development environment
    // 本地开发时，即使通过 starye.org 访问（Cloudflare tunnel），也应使用本地配置
    const isLocal = url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || url.hostname.startsWith('192.168.')
      || url.hostname.startsWith('10.')
    // Wrangler dev 环境检测：如果有 .dev.vars 配置，说明在本地
      || !!(env.API_ORIGIN && env.API_ORIGIN.includes('127.0.0.1'))

    // 1. API Service (使用缓存)
    if (path.startsWith('/api')) {
      const target = isLocal ? 'http://127.0.0.1:8787' : (env.API_ORIGIN || 'http://127.0.0.1:8787')
      return cachedProxy(request, target, undefined, { executionCtx: ctx })
    }

    // 2. Dashboard (不缓存)
    if (path.startsWith('/dashboard')) {
      if (path === '/dashboard') {
        return Response.redirect(`${url.origin}/dashboard/`, 301)
      }

      const target = isLocal ? 'http://localhost:5173' : (env.DASHBOARD_ORIGIN || 'http://localhost:5173')

      // 路径重写：仅在生产环境剥离 /dashboard 前缀
      // - 本地：Vite base='/dashboard/'，保持完整路径
      // 生产：Pages 部署在根路径，剥离前缀
      const pathRewrite = isLocal ? undefined : (p: string) => p.replace(/^\/dashboard/, '') || '/'

      return cachedProxy(request, target, pathRewrite, { bypassCache: true, executionCtx: ctx })
    }

    // 3. Movie App
    if (path.startsWith('/movie')) {
      if (path === '/movie') {
        return Response.redirect(`${url.origin}/movie/`, 301)
      }
      const target = isLocal ? 'http://localhost:3001' : (env.MOVIE_ORIGIN || 'http://localhost:3001')
      // 生产环境：移除 /movie 前缀（Pages 部署在根路径）
      const pathRewrite = isLocal ? undefined : (p: string) => p.replace(/^\/movie/, '') || '/'
      return cachedProxy(request, target, pathRewrite, { executionCtx: ctx })
    }

    // 4. Comic App
    if (path.startsWith('/comic')) {
      if (path === '/comic') {
        return Response.redirect(`${url.origin}/comic/`, 301)
      }
      const target = isLocal ? 'http://localhost:3000' : (env.COMIC_ORIGIN || 'http://localhost:3000')
      // 生产环境：移除 /comic 前缀（Pages 部署在根路径）
      const pathRewrite = isLocal ? undefined : (p: string) => p.replace(/^\/comic/, '') || '/'
      return cachedProxy(request, target, pathRewrite, { executionCtx: ctx })
    }

    // 5. Tavern App
    if (path.startsWith('/tavern')) {
      if (path === '/tavern') {
        return Response.redirect(`${url.origin}/tavern/`, 301)
      }
      const target = isLocal ? 'http://localhost:3004' : (env.TAVERN_ORIGIN || 'http://localhost:3004')
      const pathRewrite = isLocal ? undefined : (p: string) => p.replace(/^\/tavern/, '') || '/'
      return cachedProxy(request, target, pathRewrite, { executionCtx: ctx })
    }

    // 6. Auth Service (Identity Provider) (不缓存)
    if (path.startsWith('/auth')) {
      if (path === '/auth') {
        return Response.redirect(`${url.origin}/auth/`, 301)
      }
      const target = isLocal ? 'http://localhost:3003' : (env.AUTH_ORIGIN || 'http://localhost:3003')
      return cachedProxy(request, target, undefined, { bypassCache: true, executionCtx: ctx })
    }

    // 7. Blog App (Default / Main Site)
    if (path === '/') {
      return Response.redirect(`${url.origin}/blog/`, 301)
    }
    const target = isLocal ? 'http://127.0.0.1:3002' : (env.BLOG_ORIGIN || 'http://127.0.0.1:3002')
    return cachedProxy(request, target, undefined, { executionCtx: ctx })
  },
}

async function proxy(request: Request, targetOrigin: string, pathRewrite?: (path: string) => string): Promise<Response> {
  const url = new URL(request.url)
  // Ensure targetOrigin doesn't end with slash to avoid double slash
  const cleanOrigin = targetOrigin.endsWith('/') ? targetOrigin.slice(0, -1) : targetOrigin

  let targetPath = url.pathname
  if (pathRewrite) {
    targetPath = pathRewrite(targetPath)
  }

  const targetUrl = new URL(targetPath + url.search, cleanOrigin)

  const headers = new Headers(request.headers)
  headers.delete('host') // Let fetch set the correct host header for the target

  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })

  // Set standard proxy headers
  newRequest.headers.set('X-Forwarded-Host', url.host)
  newRequest.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''))
  newRequest.headers.set('X-Real-IP', request.headers.get('cf-connecting-ip') || '')

  try {
    const response = await fetch(newRequest)
    // Create a new response to allow modifying headers (like CORS or Cookies)
    return new Response(response.body, response)
  }
  catch (e) {
    return new Response(`Gateway Error: Failed to connect to ${targetOrigin}\n${e}`, { status: 502 })
  }
}
