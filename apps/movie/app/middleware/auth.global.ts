import { useSession } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSession()

  // 检查是否已登录

  if (!session.value.data) {
    // 跳转到统一登录页，并携带当前路径以便跳回
    const targetPath = to.fullPath.startsWith('/movie') ? to.fullPath : `/movie${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    const cleanTargetPath = targetPath.replace('//', '/')
    const redirectUrl = `/blog/login?redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(redirectUrl, { external: true })
  }

  const user = session.value.data.user

  const role = user.role

  const allowedRoles = ['super_admin', 'admin', 'movie_admin']

  // 检查角色权限

  if (!role || !allowedRoles.includes(role)) {
    const targetPath = to.fullPath.startsWith('/movie') ? to.fullPath : `/movie${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    const cleanTargetPath = targetPath.replace('//', '/')
    const errorUrl = `/blog/login?error=insufficient_permissions&redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(errorUrl, { external: true })
  }
})
