import { createError, defineEventHandler, getQuery, getRequestURL, sendRedirect } from 'h3'

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

export default defineEventHandler(async (event) => {
  const requestUrl = getRequestURL(event)
  const origin = requestUrl.origin
  const query = getQuery(event)
  const next = normalizeRedirect((query.next || query.redirect) as string | undefined, origin)

  const config = useRuntimeConfig()
  const apiUrl = config.public.apiBaseUrl
  const callbackURL = `${origin}/auth/login?next=${encodeURIComponent(next)}`

  const result = await $fetch<{ url?: string }>(
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

  if (!result?.url) {
    throw createError({
      statusCode: 502,
      statusMessage: 'GitHub OAuth bootstrap failed',
    })
  }

  return sendRedirect(event, result.url, 302)
})
