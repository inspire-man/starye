<script setup lang="ts">
import { Github, Loader2 } from 'lucide-vue-next'
import { signIn, useSession } from '~/lib/auth-client'

const route = useRoute()
const { data: session, isPending } = useSession()
const loading = ref(false)

// 错误信息处理
const error = computed(() => {
  const err = route.query.error as string
  if (err === 'insufficient_permissions')
    return '权限不足：需要管理员身份。'
  return err
})

// 获取回跳地址
const redirectPath = computed(() => {
  const path = route.query.redirect as string || '/'
  // 确保路径以 / 开头，或者是一个完整的 URL
  return path.startsWith('http') ? path : (path.startsWith('/') ? path : `/${path}`)
})

// 核心逻辑：如果已经有 Session，则执行跳转
watchEffect(() => {
  if (session.value && !isPending.value) {
    const target = decodeURIComponent(redirectPath.value)
    // eslint-disable-next-line no-console
    console.log('[Login] Session detected, redirecting to:', target)

    // 使用 window.location.href 确保跨应用跳转（Nuxt 路由可能无法跨域）
    if (target.startsWith('http')) {
      window.location.href = target
    }
    else {
      // 如果是相对路径，跳转到网关域下的对应应用
      window.location.href = target
    }
  }
})

async function handleGitHubLogin() {
  loading.value = true

  // 构建绝对路径的 Callback URL
  // 当 GitHub 鉴权完成后，会重定向回这个 URL
  // 这里我们让它回到当前登录页,由登录页的逻辑判断 Session 并跳转（或者 Better Auth 自动处理）
  // 更好的方式是：如果 redirectPath 是绝对路径，直接用它；如果是相对路径，拼接 Origin

  // NOTE: Better Auth 的 callbackURL 是指 OAuth Provider 回调后前端要访问的地址。
  // 通常我们设置为当前页，或者一个专门的处理页。
  // 为了简单，我们设置为当前页，带上相同的查询参数
  const callbackURL = window.location.href

  // eslint-disable-next-line no-console
  console.log('[Login] Initiating GitHub login, callbackURL:', callbackURL)

  await signIn.social({
    provider: 'github',
    callbackURL,
  })
}
</script>

<template>
  <div class="w-full max-w-sm p-10 space-y-8 bg-card rounded-3xl border border-border/40 shadow-xl text-center">
    <div class="space-y-3">
      <h1 class="text-3xl font-extrabold tracking-tight">
        STARYE ID
      </h1>
      <p class="text-sm text-muted-foreground">
        Unified Identity Service
      </p>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="error"
      class="p-4 bg-destructive/10 text-destructive text-xs rounded-xl font-bold border border-destructive/20"
    >
      {{ error }}
    </div>

    <div class="py-4">
      <button
        :disabled="loading"
        class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl font-bold transition-all disabled:opacity-50 shadow-lg"
        @click="handleGitHubLogin"
      >
        <Loader2 v-if="loading" class="animate-spin h-5 w-5" />
        <Github v-else class="w-6 h-6" />
        Login with GitHub
      </button>
    </div>

    <p class="text-[10px] text-muted-foreground uppercase tracking-widest">
      Protected by Better Auth
    </p>
  </div>
</template>
