import type { Context } from 'hono'
import type { AppEnv, SessionUser } from '../../../types'

/**
 * 检查用户是否为管理员
 */
export async function checkIsAdmin(c: Context<AppEnv>): Promise<boolean> {
  try {
    const auth = c.get('auth')
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const user = session?.user as unknown as SessionUser | undefined
    return user?.role === 'admin'
  }
  catch {
    return false
  }
}
