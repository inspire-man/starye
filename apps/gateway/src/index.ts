/**
 * Cloudflare Gateway Worker
 *
 * Routes traffic to different services based on path.
 * In development: Uses localhost ports.
 * In production: Uses environment variable origins.
 */

interface Env {
  API_ORIGIN?: string
  DASHBOARD_ORIGIN?: string
  BLOG_ORIGIN?: string
  MOVIE_ORIGIN?: string
  COMIC_ORIGIN?: string
  AUTH_ORIGIN?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Detect local development environment based on hostname
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.')

    // 1. API Service
    if (path.startsWith('/api')) {
      const target = isLocal ? 'http://127.0.0.1:8787' : (env.API_ORIGIN || 'http://127.0.0.1:8787')
      return proxy(request, target)
    }

    // 2. Dashboard
    if (path.startsWith('/dashboard')) {
      if (path === '/dashboard') {
        return Response.redirect(`${url.origin}/dashboard/`, 301)
      }
      const target = isLocal ? 'http://localhost:5173' : (env.DASHBOARD_ORIGIN || 'http://localhost:5173')
      // 本地和生产都剥离 /dashboard 前缀（Dashboard 使用 base: '/' 构建）
      const pathRewrite = (p: string) => p.replace(/^\/dashboard/, '') || '/'
      return proxy(request, target, pathRewrite)
    }

    // 3. Movie App
    if (path.startsWith('/movie')) {
      if (path === '/movie') {
        return Response.redirect(`${url.origin}/movie/`, 301)
      }
      const target = isLocal ? 'http://localhost:3001' : (env.MOVIE_ORIGIN || 'http://localhost:3001')
      // 生产环境：移除 /movie 前缀（Pages 部署在根路径）
      const pathRewrite = isLocal ? undefined : (p: string) => p.replace(/^\/movie/, '') || '/'
      return proxy(request, target, pathRewrite)
    }

    // 4. Comic App
    if (path.startsWith('/comic')) {
      if (path === '/comic') {
        return Response.redirect(`${url.origin}/comic/`, 301)
      }
      const target = isLocal ? 'http://localhost:3000' : (env.COMIC_ORIGIN || 'http://localhost:3000')
      // 生产环境：移除 /comic 前缀（Pages 部署在根路径）
      const pathRewrite = isLocal ? undefined : (p: string) => p.replace(/^\/comic/, '') || '/'
      return proxy(request, target, pathRewrite)
    }

    // 5. Auth Service (Identity Provider)
    if (path.startsWith('/auth')) {
      if (path === '/auth') {
        return Response.redirect(`${url.origin}/auth/`, 301)
      }
      const target = isLocal ? 'http://localhost:3003' : (env.AUTH_ORIGIN || 'http://localhost:3003')
      return proxy(request, target)
    }

    // 6. Blog App (Default / Main Site)
    if (path === '/') {
      return Response.redirect(`${url.origin}/blog/`, 301)
    }
    const target = isLocal ? 'http://127.0.0.1:3002' : (env.BLOG_ORIGIN || 'http://127.0.0.1:3002')
    return proxy(request, target)
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
