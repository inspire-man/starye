import { createAuthClient } from 'better-auth/vue'

function useAuthClient() {
  const { public: publicRuntime } = useRuntimeConfig()

  return createAuthClient({
    baseURL: `${publicRuntime.apiBaseUrl}/api/auth`,
  })
}

export function useSession() {
  return useAuthClient().useSession()
}
