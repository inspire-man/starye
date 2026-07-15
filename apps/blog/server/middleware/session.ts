/**
 * Phase 1 / AUTH-02 / D-01..D-04
 *
 * Blog SSR 阶段预取 /api/auth/get-session：
 * - D-01: 把浏览器 cookie 原样 forward 到 gateway（只取 cookie 头）
 * - D-02: baseURL 走 runtimeConfig.public.apiUrl（gateway 原点），不直连 api
 * - D-03: 3s 超时 / 5xx / 网络错 → 降级匿名，不抛异常
 * - D-04: event.context 单例，请求内只调用一次
 *
 * 安全：仅 pick cookie 头，防止 SSR 转发其他敏感头到上游（T3 缓解）。
 */

import { defineEventHandler, getHeader, getRequestURL } from 'h3'

interface SessionPayload {
  user: unknown
  session: unknown
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  if (url.pathname.startsWith('/api') || url.pathname.includes('.')) {
    return
  }

  const cookie = getHeader(event, 'cookie')
  if (!cookie) {
    event.context.session = null
    return
  }

  const config = useRuntimeConfig()
  const apiUrl = config.public.apiBaseUrl

  try {
    const session = await $fetch<SessionPayload | null>(
      '/api/auth/get-session',
      {
        baseURL: apiUrl,
        headers: { cookie },
        signal: AbortSignal.timeout(3000),
        retry: false,
      },
    )
    event.context.session = session ?? null
  }
  catch {
    event.context.session = null
  }
})
