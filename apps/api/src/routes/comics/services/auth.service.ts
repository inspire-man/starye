import type { SessionUser } from '../../../types'

/**
 * 检查用户是否为成人（R18 权限）
 */
export function checkUserAdultStatus(user?: SessionUser): boolean {
  return user?.isAdult === true
}
