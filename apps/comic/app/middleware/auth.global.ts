import { useSession } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSession()

  // 检查是否已登录

  if (!session.value.data) {
    const redirectUrl = `/blog/login?redirect=${encodeURIComponent(to.fullPath)}`

    return navigateTo(redirectUrl, { external: true })
  }

  const user = session.value.data.user

  const role = user.role

  const allowedRoles = ['super_admin', 'admin', 'comic_admin']

  // 检查权限

  if (!role || !allowedRoles.includes(role)) {
    const errorUrl = `/blog/login?error=insufficient_permissions&redirect=${encodeURIComponent(to.fullPath)}`

    return navigateTo(errorUrl, { external: true })
  }
})
