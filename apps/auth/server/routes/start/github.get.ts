import { appendResponseHeader, createError, defineEventHandler, getQuery, sendRedirect } from 'h3'

function normalizeRedirect(raw: string | undefined, origin: string): string {
  const candidate = raw || '/'
  try {
    const target = new URL(candidate, origin)
    if (target.origin !== origin) {
      return '/'
    }
    return target.pathname + target.search + target.hash || '/'
  }
  catch {
    return '/'
  }
}

export function readSetCookieHeaders(headers: Headers): string[] {
  const cookieHeaders = headers as Headers & { getSetCookie?: () => string[] }
  const values = cookieHeaders.getSetCookie?.()
  if (values) {
    return values
  }

  const value = headers.get('set-cookie')
  return value ? [value] : []
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const origin = config.public.gatewayBaseUrl
  const query = getQuery(event)
  const next = normalizeRedirect((query.next || query.redirect) as string | undefined, origin)
  const apiUrl = config.public.apiBaseUrl
  const callbackURL = `${origin}/auth/login?next=${encodeURIComponent(next)}`

  const response = await $fetch.raw<{ url?: string }>(
    '/api/auth/sign-in/social',
    {
      baseURL: apiUrl,
      method: 'POST',
      body: {
        provider: 'github',
        callbackURL,
      },
      retry: false,
    },
  )

  for (const setCookie of readSetCookieHeaders(response.headers)) {
    appendResponseHeader(event, 'set-cookie', setCookie)
  }

  const result = response._data

  if (!result?.url) {
    throw createError({
      statusCode: 502,
      statusMessage: 'GitHub OAuth bootstrap failed',
    })
  }

  return sendRedirect(event, result.url, 302)
})
