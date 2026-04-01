import type { SessionUser } from '../../../types'

/**
 * 检查用户是否为成人（R18 权限）
 *
 * 增强版本: 检查 isAdult, isR18Verified, 或 admin 角色
 */
export function checkUserAdultStatus(user?: SessionUser): boolean {
  if (!user) {
    return false
  }

  return !!(user.isAdult || user.isR18Verified || user.role === 'admin')
}
