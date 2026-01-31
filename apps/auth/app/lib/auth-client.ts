import { createAuthClient } from 'better-auth/vue'

// Prioritize Runtime Config compatible env vars, then Vite vars, then production fallback
// eslint-disable-next-line node/prefer-global/process
const apiUrl = process.env.NUXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || 'https://starye.org'

export const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})

export const { signIn, signUp, signOut, useSession } = authClient
