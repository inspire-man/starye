import { useSession } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware((to) => {
  const session = useSession()
  const user = session.value.data?.user

  // 检查用户是否已验证成人身份
  if (!user?.isAdult) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath, reason: 'adult_verification' },
    })
  }
})
