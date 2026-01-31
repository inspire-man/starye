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
      // Dashboard is a pure SPA deployed at root of Pages
      // We need to strip the /dashboard prefix so it requests /assets/... from the Pages origin
      const target = isLocal ? 'http://localhost:5173' : (env.DASHBOARD_ORIGIN || 'http://localhost:5173')
      return proxy(request, target, p => p.replace(/^\/dashboard/, ''))
    }

    // 3. Movie App
    if (path.startsWith('/movie')) {
      if (path === '/movie') {
        return Response.redirect(`${url.origin}/movie/`, 301)
      }
      const target = isLocal ? 'http://localhost:3001' : (env.MOVIE_ORIGIN || 'http://localhost:3001')
      return proxy(request, target)
    }

    // 4. Comic App
    if (path.startsWith('/comic')) {
      if (path === '/comic') {
        return Response.redirect(`${url.origin}/comic/`, 301)
      }
      const target = isLocal ? 'http://localhost:3000' : (env.COMIC_ORIGIN || 'http://localhost:3000')
      return proxy(request, target)
    }

    // 5. Blog App (Default / Main Site)
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
