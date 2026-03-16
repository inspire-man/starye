import { createAuthClient } from 'better-auth/vue'

// 使用相对路径，通过 Gateway 转发到 API
export const authClient = createAuthClient({
  baseURL: '/api/auth',
})

export const { signIn, signUp, useSession, signOut } = authClient
