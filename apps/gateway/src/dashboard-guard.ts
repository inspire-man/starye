/**
 * Gateway dashboard 鉴权守卫
 * 覆盖：ACCESS-01（未登录 302）、ACCESS-02（白名单判断）
 */

// 模块顶层：Worker 实例生命周期内有效的 L1 缓存（D-02）
interface CachedSession {
  githubId: string
  expiresAt: number
}
const sessionCache = new Map<string, CachedSession>()
const SESSION_CACHE_TTL = 30_000 // 30s，固定不配置化

export interface DashboardAuthResult {
  allowed: boolean
  reason?: 'no_session' | 'not_admin'
}

/**
 * 判断 githubId 是否在 ADMIN_GITHUB_ID 白名单中（D-03）
 * 支持单个 ID（"12345678"）或逗号分隔多个（"12345,67890"）
 */
export function isInAdminWhitelist(githubId: string, adminEnv?: string): boolean {
  if (!adminEnv)
    return false
  return adminEnv.split(',').map(s => s.trim()).includes(String(githubId))
}

/**
 * 检查 dashboard 访问权限（D-01）
 * 1. 从 cookie 提取 session token
 * 2. 查 L1 缓存（30s TTL）
 * 3. 缓存 miss 时 fetch API_ORIGIN/api/auth/get-session
 * 4. 判断 user.githubId 是否在 ADMIN_GITHUB_ID 白名单中
 */
export async function checkDashboardAuth(
  request: Request,
  env: { API_ORIGIN?: string, ADMIN_GITHUB_ID?: string },
): Promise<DashboardAuthResult> {
  const cookie = request.headers.get('cookie') || ''
  // cookie 名称：starye.session_token（来自 auth.ts cookiePrefix: 'starye'）
  const tokenMatch = cookie.match(/starye\.session_token=([^;]+)/)
  if (!tokenMatch)
    return { allowed: false, reason: 'no_session' }

  const token = decodeURIComponent(tokenMatch[1])
  const now = Date.now()

  // L1 缓存查询（best-effort 加速，不是安全边界）
  const cached = sessionCache.get(token)
  if (cached && cached.expiresAt > now) {
    return isInAdminWhitelist(cached.githubId, env.ADMIN_GITHUB_ID)
      ? { allowed: true }
      : { allowed: false, reason: 'not_admin' }
  }

  // 缓存 miss：fetch API 获取 session
  const apiOrigin = env.API_ORIGIN || 'http://127.0.0.1:8787'
  let data: { user?: { githubId?: string | number } } | null = null
  try {
    const resp = await fetch(`${apiOrigin}/api/auth/get-session`, {
      headers: { cookie },
    })
    if (!resp.ok)
      return { allowed: false, reason: 'no_session' }
    data = await resp.json()
  }
  catch {
    // fetch 失败（API 不可达）时 fail-closed，拒绝访问
    return { allowed: false, reason: 'no_session' }
  }

  if (!data?.user)
    return { allowed: false, reason: 'no_session' }

  // githubId 来自 Better Auth additionalFields（Plan 01 已注入）
  const githubId = String(data.user.githubId || '')
  if (!githubId)
    return { allowed: false, reason: 'not_admin' }

  // 写入 L1 缓存
  sessionCache.set(token, { githubId, expiresAt: now + SESSION_CACHE_TTL })

  return isInAdminWhitelist(githubId, env.ADMIN_GITHUB_ID)
    ? { allowed: true }
    : { allowed: false, reason: 'not_admin' }
}
