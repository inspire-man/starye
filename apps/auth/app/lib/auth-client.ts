import { createAuthClient } from 'better-auth/vue'

// For client-side code, use Vite's import.meta.env instead of process.env
// In production, VITE_API_URL will be replaced by the build-time value
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const authClient = createAuthClient({
  baseURL: `${apiUrl}/api/auth`,
})

export const { signIn, signUp, signOut, useSession } = authClient
