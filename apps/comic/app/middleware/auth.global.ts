import { authClient } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  let sessionData

  if (import.meta.server) {
    const headers = useRequestHeaders(['cookie', 'user-agent'])
    // eslint-disable-next-line no-console
    console.log('[SSR Auth] Fetching session with headers:', headers)

    try {
      const { data, error } = await authClient.getSession({
        fetchOptions: {
          headers,
        },
      })
      // eslint-disable-next-line no-console
      console.log('[SSR Auth] Result:', { data, error })
      sessionData = data
    }
    catch (e) {
      console.error('[SSR Auth] Exception:', e)
    }
  }
  else {
    // 客户端：主动获取 Session，而不是依赖 useSession 的响应式状态
    // eslint-disable-next-line no-console
    console.log('[CSR Auth] Fetching session on client side')

    try {
      const { data, error } = await authClient.getSession()
      // eslint-disable-next-line no-console
      console.log('[CSR Auth] Result:', { data, error })
      sessionData = data
    }
    catch (e) {
      console.error('[CSR Auth] Exception:', e)
    }
  }

  // 检查是否已登录
  if (!sessionData) {
    const targetPath = to.fullPath.startsWith('/comic') ? to.fullPath : `/comic${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    const cleanTargetPath = targetPath.replace('//', '/')
    const redirectUrl = `/auth/login?redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(redirectUrl, { external: true })
  }

  const user = sessionData.user
  const role = user.role
  const allowedRoles = ['super_admin', 'admin', 'comic_admin']

  // eslint-disable-next-line no-console
  console.log('[Comic Auth] User role:', role, 'Allowed roles:', allowedRoles)

  if (!role || !allowedRoles.includes(role)) {
    const targetPath = to.fullPath.startsWith('/comic') ? to.fullPath : `/comic${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    const cleanTargetPath = targetPath.replace('//', '/')
    const errorUrl = `/auth/login?error=insufficient_permissions&redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(errorUrl, { external: true })
  }
})
