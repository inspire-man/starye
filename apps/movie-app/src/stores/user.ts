import type { User } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authApi } from '../api'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)

  async function fetchUser() {
    loading.value = true
    try {
      const response = await authApi.getSession()
      // Better Auth 直接返回 { user: {...}, session: {...} } 或 null
      if (response && response.user) {
        user.value = response.user
      }
      else {
        user.value = null
      }
    }
    catch (error) {
      console.error('Failed to fetch user session:', error)
      user.value = null
    }
    finally {
      loading.value = false
    }
  }

  function signIn() {
    authApi.signIn()
  }

  async function signOut() {
    await authApi.signOut()
    user.value = null
  }

  return {
    user,
    loading,
    fetchUser,
    signIn,
    signOut,
  }
})
