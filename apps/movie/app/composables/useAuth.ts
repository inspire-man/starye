import { useSession } from '~/lib/auth-client'

export function useAuth() {
  const session = useSession()

  const isAuthenticated = computed(() => !!session.value.data?.user)
  const isAdult = computed(() => session.value.data?.user?.isAdult === true)
  const isAdmin = computed(() => session.value.data?.user?.role === 'admin')
  const user = computed(() => session.value.data?.user)

  return {
    isAuthenticated,
    isAdult,
    isAdmin,
    user,
    session,
  }
}
