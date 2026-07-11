/**
 * Cloudflare Gateway Worker
 *
 * Routes traffic to different services based on path.
 * In development: Uses localhost ports.
 * In production: Uses environment variable origins.
 */

import type { CloudflareOptions } from '@sentry/cloudflare'
import * as Sentry from '@sentry/cloudflare'
import { createCachedProxy } from './cache-middleware'
import { checkDashboardAuth } from './dashboard-guard'

interface Env {
  API_ORIGIN?: string
  DASHBOARD_ORIGIN?: string
  BLOG_ORIGIN?: string
  MOVIE_ORIGIN?: string
  COMIC_ORIGIN?: string
  TAVERN_ORIGIN?: string
  AUTH_ORIGIN?: string
  CACHE?: KVNamespace
  ADMIN_GITHUB_ID?: string // 逗号分隔的 GitHub ID 白名单（D-03）
  SENTRY_DSN?: string
  SENTRY_RELEASE?: string
}

const SENTRY_NOISE_PATTERNS = [
  'aborterror',
  'networkerror',
  'failed to fetch',
  'request timed out',
  'network request failed',
  'the operation was aborted',
  'the user aborted a request',
]

type SentryBeforeSend = NonNullable<CloudflareOptions['beforeSend']>
type SentryErrorEvent = Parameters<SentryBeforeSend>[0]
type SentryErrorHint = Parameters<SentryBeforeSend>[1]

function shouldDropSentryNoise(event: SentryErrorEvent, hint: SentryErrorHint): boolean {
  const exceptionText = [
    hint.originalException instanceof Error ? hint.originalException.name : '',
    hint.originalException instanceof Error ? hint.originalException.message : '',
    event.message ?? '',
    ...(event.exception?.values?.flatMap((value: { type?: string, value?: string }) => [value.type ?? '', value.value ?? '']) ?? []),
  ]
    .join(' ')
    .toLowerCase()

  return SENTRY_NOISE_PATTERNS.some(pattern => exceptionText.includes(pattern))
}

const gatewayHandler = {
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

    // 0. robots.txt（D-15：在所有 proxy 分支之前 match，避免被 blog fallback 捕获）
    if (path === '/robots.txt') {
      return new Response(
        'User-agent: *\nDisallow: /dashboard\nDisallow: /auth\nDisallow: /api\n',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      )
    }

    // 1. API Service (使用缓存)
    if (path.startsWith('/api')) {
      const target = isLocal ? 'http://127.0.0.1:8787' : (env.API_ORIGIN || 'http://127.0.0.1:8787')
      return cachedProxy(request, target, undefined, { executionCtx: ctx })
    }

    // 2. Dashboard (不缓存，前置鉴权)
    if (path.startsWith('/dashboard')) {
      if (path === '/dashboard') {
        return Response.redirect(`${url.origin}/dashboard/`, 301)
      }

      // D-01：Gateway 前置鉴权，在 cachedProxy 之前执行
      const authResult = await checkDashboardAuth(request, env)
      if (!authResult.allowed) {
        const next = encodeURIComponent(url.pathname + url.search)
        const errorParam = authResult.reason === 'not_admin' ? '&error=not_admin' : ''
        return Response.redirect(`${url.origin}/auth/login?next=${next}${errorParam}`, 302)
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
    // D-15：对 /dashboard/* 和 /api/admin/* 注入 X-Robots-Tag
    const mutableHeaders = new Headers(response.headers)
    if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/api/admin')) {
      mutableHeaders.set('X-Robots-Tag', 'noindex, nofollow')
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: mutableHeaders })
  }
  catch (e) {
    Sentry.captureException(e, {
      tags: {
        subsystem: 'gateway-proxy',
      },
      extra: {
        path: url.pathname,
        targetOrigin,
      },
    })
    return new Response(`Gateway Error: Failed to connect to ${targetOrigin}\n${e}`, { status: 502 })
  }
}

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    enabled: Boolean(env.SENTRY_DSN),
    release: env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    integrations: [
      Sentry.honoIntegration(),
    ],
    beforeSend(event: SentryErrorEvent, hint: SentryErrorHint) {
      if (shouldDropSentryNoise(event, hint)) {
        return null
      }
      return event
    },
  }),
  gatewayHandler,
)
