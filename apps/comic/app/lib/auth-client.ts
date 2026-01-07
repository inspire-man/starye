import { createAuthClient } from 'better-auth/vue'

export const { signIn, signUp, useSession, signOut } = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
})
