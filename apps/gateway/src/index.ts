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

    // 1. API Service
    if (path.startsWith('/api')) {
      return proxy(request, env.API_ORIGIN || 'http://127.0.0.1:8787')
    }

    // 2. Dashboard
    if (path.startsWith('/dashboard')) {
      if (path === '/dashboard') {
        return Response.redirect(`${url.origin}/dashboard/`, 301)
      }
      return proxy(request, env.DASHBOARD_ORIGIN || 'http://localhost:5173')
    }

    // 3. Movie App
    if (path.startsWith('/movie')) {
      if (path === '/movie') {
        return Response.redirect(`${url.origin}/movie/`, 301)
      }
      return proxy(request, env.MOVIE_ORIGIN || 'http://localhost:3001')
    }

    // 4. Comic App
    if (path.startsWith('/comic')) {
      if (path === '/comic') {
        return Response.redirect(`${url.origin}/comic/`, 301)
      }
      return proxy(request, env.COMIC_ORIGIN || 'http://localhost:3000')
    }

    // 5. Blog App (Default / Main Site)
    return proxy(request, env.BLOG_ORIGIN || 'http://127.0.0.1:3002')
  },
}

async function proxy(request: Request, targetOrigin: string): Promise<Response> {
  const url = new URL(request.url)
  // Ensure targetOrigin doesn't end with slash to avoid double slash
  const cleanOrigin = targetOrigin.endsWith('/') ? targetOrigin.slice(0, -1) : targetOrigin
  const targetUrl = new URL(url.pathname + url.search, cleanOrigin)

  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: new Headers(request.headers),
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
    const newResponse = new Response(response.body, response)
    return newResponse
  }
  catch (e) {
    return new Response(`Gateway Error: Failed to connect to ${targetOrigin}\n${e}`, { status: 502 })
  }
}
