import { createAuthClient } from 'better-auth/vue'

// Prioritize Runtime Config compatible env vars, then Vite vars, then local dev fallback
// eslint-disable-next-line node/prefer-global/process
const apiUrl = process.env.NUXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})

export const { signIn, signUp, signOut, useSession } = authClient
