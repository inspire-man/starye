import { authClient, useSession } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  let sessionData

  if (import.meta.server) {
    const headers = useRequestHeaders(['cookie'])
    const { data } = await authClient.getSession({
      fetchOptions: {
        headers,
      },
    })
    sessionData = data
  }
  else {
    const session = useSession()
    sessionData = session.value.data
  }

  // 检查是否已登录

  if (!sessionData) {
    // 跳转到统一登录页，并携带当前路径以便跳回
    const targetPath = to.fullPath.startsWith('/movie') ? to.fullPath : `/movie${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    const cleanTargetPath = targetPath.replace('//', '/')
    const redirectUrl = `/blog/login?redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(redirectUrl, { external: true })
  }

  const user = sessionData.user

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
