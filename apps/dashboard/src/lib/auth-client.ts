import { createAuthClient } from 'better-auth/vue'

// Better Auth 需要完整的 URL（不能使用相对路径）
// 在浏览器环境，使用当前域名
const baseURL = typeof window !== 'undefined'
  ? `${window.location.origin}/api/auth`
  : 'http://localhost:8080/api/auth'

export const authClient = createAuthClient({
  baseURL,
})

export const { signIn, signUp, useSession, signOut } = authClient
