import { createAuthClient } from 'better-auth/vue'

const { public: publicRuntime } = useRuntimeConfig()

export const authClient = createAuthClient({
  baseURL: `${publicRuntime.apiBaseUrl}/api/auth`,
})

export const { signIn, signUp, signOut, useSession } = authClient
