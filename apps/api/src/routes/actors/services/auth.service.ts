import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { user } from '@starye/db/schema'
import { eq } from 'drizzle-orm'

/**
 * 检查用户是否为成人（R18 权限）
 */
export async function checkUserAdultStatus(c: Context<AppEnv>): Promise<boolean> {
  const auth = c.get('auth')
  const db = c.get('db')

  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const userId = session?.user?.id

  if (!userId) {
    return false
  }

  const dbUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { isAdult: true, isR18Verified: true, role: true },
  })

  return !!(dbUser?.isAdult || dbUser?.isR18Verified || dbUser?.role === 'admin')
}
