import type { Ref } from 'vue'
import type { ExtendedSession } from '~/types/auth'
import { createAuthClient } from 'better-auth/vue'

export function useAuthClient() {
  const { public: publicRuntime } = useRuntimeConfig()

  return createAuthClient({
    baseURL: `${publicRuntime.apiBaseUrl}/api/auth`,
  })
}

export function useSession(authClient = useAuthClient()) {
  const session = authClient.useSession()

  return session as Ref<{
    data: ExtendedSession | null
    isPending: boolean
    error: Error | null
  }>
}
