import type { Context } from 'hono'
import type { AppEnv, SessionUser } from '../../../types'

/**
 * 检查用户是否为成人（R18 权限）
 */
export async function checkUserAdultStatus(c: Context<AppEnv>): Promise<boolean> {
  const auth = c.get('auth')
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const user = session?.user as SessionUser | undefined
  return user?.isAdult === true
}
