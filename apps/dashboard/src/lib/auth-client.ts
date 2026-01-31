import { createAuthClient } from 'better-auth/vue'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})

export const { signIn, signUp, useSession, signOut } = authClient
