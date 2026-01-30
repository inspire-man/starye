import type { Ref } from 'vue'
import type { ExtendedSession } from '~/types/auth'
import { createAuthClient } from 'better-auth/vue'

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

export const { signIn, signUp, signOut } = authClient

export function useSession() {
  const session = authClient.useSession()

  return session as Ref<{
    data: ExtendedSession | null
    isPending: boolean
    error: Error | null
  }>
}
