import { useSession } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSession()

  // 检查是否已登录

  if (!session.value.data) {
    const targetPath = to.fullPath.startsWith('/comic') ? to.fullPath : `/comic${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    // Clean up potential double slashes just in case
    const cleanTargetPath = targetPath.replace('//', '/')
    const redirectUrl = `/blog/login?redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(redirectUrl, { external: true })
  }

  const user = session.value.data.user

  const role = user.role

  const allowedRoles = ['super_admin', 'admin', 'comic_admin']

  // 检查权限

  if (!role || !allowedRoles.includes(role)) {
    const targetPath = to.fullPath.startsWith('/comic') ? to.fullPath : `/comic${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    const cleanTargetPath = targetPath.replace('//', '/')
    const errorUrl = `/blog/login?error=insufficient_permissions&redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(errorUrl, { external: true })
  }
})
