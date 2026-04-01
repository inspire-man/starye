import type { SessionUser } from '../../../types'

/**
 * 检查用户是否为管理员
 */
export function checkIsAdmin(user?: SessionUser): boolean {
  return user?.role === 'admin'
}
