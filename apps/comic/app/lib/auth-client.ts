import type { Ref } from 'vue'
import type { ExtendedSession } from '~/types/auth'
import { createAuthClient } from 'better-auth/vue'

// Prioritize Runtime Config compatible env vars, then Vite vars, then production fallback
// eslint-disable-next-line node/prefer-global/process
const apiUrl = process.env.NUXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || 'https://starye.org'

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
