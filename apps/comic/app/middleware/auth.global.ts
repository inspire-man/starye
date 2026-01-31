import { authClient, useSession } from '~/lib/auth-client'

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
    const session = useSession()
    sessionData = session.value.data
  }

  // 检查是否已登录

  if (!sessionData) {
    const targetPath = to.fullPath.startsWith('/comic') ? to.fullPath : `/comic${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    // Clean up potential double slashes just in case
    const cleanTargetPath = targetPath.replace('//', '/')
    const redirectUrl = `/auth/login?redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(redirectUrl, { external: true })
  }

  const user = sessionData.user

  const role = user.role

  const allowedRoles = ['super_admin', 'admin', 'comic_admin']

  // 检查权限

  if (!role || !allowedRoles.includes(role)) {
    const targetPath = to.fullPath.startsWith('/comic') ? to.fullPath : `/comic${to.fullPath.startsWith('/') ? '' : '/'}${to.fullPath}`
    const cleanTargetPath = targetPath.replace('//', '/')
    const errorUrl = `/auth/login?error=insufficient_permissions&redirect=${encodeURIComponent(cleanTargetPath)}`

    return navigateTo(errorUrl, { external: true })
  }
})
