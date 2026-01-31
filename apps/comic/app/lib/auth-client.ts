import type { Ref } from 'vue'
import type { ExtendedSession } from '~/types/auth'
import { createAuthClient } from 'better-auth/vue'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})

export { authClient }

export const { signIn, signUp, signOut } = authClient

export function useSession() {
  const session = authClient.useSession()

  return session as Ref<{
    data: ExtendedSession | null
    isPending: boolean
    error: Error | null
  }>
}
