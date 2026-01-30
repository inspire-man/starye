import type { Ref } from 'vue'
import type { ExtendedSession } from '~/types/auth'
import { createAuthClient } from 'better-auth/vue'

const config = useRuntimeConfig()

const authClient = createAuthClient({
  baseURL: config.public.apiUrl as string,
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
