export interface QuantAuthResult {
  allowed: boolean
  reason?: 'no_session'
}

interface QuantSessionEnv {
  API_ORIGIN?: string
}

/** Quant is a private user workspace, but it is not an administrator surface. */
export async function checkQuantAuth(request: Request, env: QuantSessionEnv): Promise<QuantAuthResult> {
  const cookie = request.headers.get('cookie') || ''
  if (!/starye\.session_token=[^;]+/.test(cookie))
    return { allowed: false, reason: 'no_session' }

  const apiOrigin = env.API_ORIGIN || 'http://127.0.0.1:8787'
  try {
    const response = await fetch(`${apiOrigin}/api/auth/get-session`, {
      headers: { cookie },
    })
    if (!response.ok)
      return { allowed: false, reason: 'no_session' }
    const data = await response.json() as { user?: unknown } | null
    return data?.user ? { allowed: true } : { allowed: false, reason: 'no_session' }
  }
  catch {
    return { allowed: false, reason: 'no_session' }
  }
}
