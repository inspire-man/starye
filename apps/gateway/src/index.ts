/**
 * Local Development Gateway
 *
 * Simulates the production routing environment locally.
 * - /api/*       -> API Service (Port 8787)
 * - /dashboard/* -> Dashboard (Port 5173)
 * - /*           -> Comic App (Port 3000)
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // 1. API Service
    if (path.startsWith('/api')) {
      // Strip /api prefix if your API worker doesn't expect it,
      // BUT our API worker is mounted on a subdomain, so it likely handles root paths.
      // However, Hono usually handles paths relative to where it's mounted.
      // Let's assume API runs on port 8787 and handles full paths.

      // We keep the path as is, assuming API handles /api prefix or we rewrite it.
      // In production, api.starye.org/api/comics -> API Worker.
      // Locally, localhost:8080/api/comics -> localhost:8787/api/comics

      return proxy(request, 'http://127.0.0.1:8787')
    }

    // 2. Dashboard
    // Dashboard is an SPA. We might need to handle assets carefully.
    if (path.startsWith('/dashboard')) {
      if (path === '/dashboard') {
        return Response.redirect(`${url.origin}/dashboard/`, 301)
      }
      return proxy(request, 'http://localhost:5173')
    }

    // 3. Blog App
    if (path.startsWith('/blog')) {
      if (path === '/blog') {
        return Response.redirect(`${url.origin}/blog/`, 301)
      }
      return proxy(request, 'http://localhost:3002')
    }

    // 4. Movie App
    if (path.startsWith('/movie')) {
      if (path === '/movie') {
        return Response.redirect(`${url.origin}/movie/`, 301)
      }
      return proxy(request, 'http://localhost:3001')
    }

    // 5. Comic App (Main Site)
    // Default fallthrough
    return proxy(request, 'http://127.0.0.1:3000')
  },
}

async function proxy(request: Request, targetOrigin: string): Promise<Response> {
  const url = new URL(request.url)
  const targetUrl = new URL(url.pathname + url.search, targetOrigin)

  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual', // Important: Let the browser handle redirects (e.g. Auth callbacks)
  })

  // Add a header to indicate proxying
  newRequest.headers.set('X-Forwarded-Host', url.host)

  try {
    return await fetch(newRequest)
  }
  catch (e) {
    return new Response(`Gateway Error: Failed to connect to ${targetOrigin}\n${e}`, { status: 502 })
  }
}
