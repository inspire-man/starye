/**
 * 权限检查 Composable
 *
 * 用于前端的权限控制
 */

import { computed } from 'vue'
import { useSession } from '@/lib/auth-client'

export type Role = 'super_admin' | 'admin' | 'comic_admin' | 'movie_admin' | 'user'
export type Resource = 'comic' | 'movie' | 'global'

const PERMISSION_MATRIX: Record<Resource, Role[]> = {
  comic: ['admin', 'super_admin', 'comic_admin'],
  movie: ['admin', 'super_admin', 'movie_admin'],
  global: ['admin', 'super_admin'],
}

export function useResourceGuard() {
  const session = useSession()

  const userRole = computed(() => ((session.value?.data?.user as { role?: string })?.role as Role) || 'user')

  const hasPermission = (resource: Resource): boolean => {
    const allowedRoles = PERMISSION_MATRIX[resource]
    return allowedRoles.includes(userRole.value)
  }

  const canAccessComics = computed(() => hasPermission('comic'))
  const canAccessMovies = computed(() => hasPermission('movie'))
  const canAccessGlobal = computed(() => hasPermission('global'))

  const canAccessCrawler = (type: 'comic' | 'movie'): boolean => {
    if (userRole.value === 'admin' || userRole.value === 'super_admin') {
      return true
    }

    if (type === 'comic' && userRole.value === 'comic_admin') {
      return true
    }

    if (type === 'movie' && userRole.value === 'movie_admin') {
      return true
    }

    return false
  }

  return {
    userRole,
    hasPermission,
    canAccessComics,
    canAccessMovies,
    canAccessGlobal,
    canAccessCrawler,
  }
}
