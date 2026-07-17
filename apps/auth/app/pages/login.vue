<script setup lang="ts">
import { Github } from 'lucide-vue-next'
import { useSession } from '~/lib/auth-client'

const route = useRoute()
const sessionData = useSession()
const seededSession = useState<{ user?: unknown, session?: unknown } | null>('session', () => null)
const requestOrigin = import.meta.server ? useRequestURL().origin : window.location.origin

// 安全访问 session 数据
const session = computed(() => sessionData.value?.data || seededSession.value || null)
const isPending = computed(() => sessionData.value?.isPending || false)

// 错误信息处理
const error = computed(() => {
  const err = route.query.error as string
  if (err === 'not_admin')
    return '此账号没有管理员权限。' // D-05 新增
  if (err === 'insufficient_permissions')
    return '权限不足：需要管理员身份。'
  return err
})

// 获取回跳地址
// 安全说明（CR-01 修复 / D-14）：
//   之前在这里做同源校验，然后在 watchEffect 里对 redirectPath 再次 decodeURIComponent，
//   造成"先校验后再解码"的顺序错位。例如 `%252F%252Fevil.com` 可以先通过同源校验、
//   再被第二次解码成 `///evil.com`，被浏览器折叠跳转到 evil.com。
//   因此本 computed 不再返回"裸路径"，改为返回一个已经经过最终同源校验的
//   same-origin 相对路径（pathname + search + hash）。下游直接使用，不再解码。
const redirectPath = computed(() => {
  // 同时支持 next（Phase 2 新增）和 redirect（向后兼容 dashboard router.beforeEach）
  const raw = (route.query.next || route.query.redirect) as string || '/'
  try {
    const target = new URL(raw, requestOrigin)
    if (target.origin !== requestOrigin)
      return '/'
    // 只取相对部分，彻底切断回跳到外部域名的可能
    return target.pathname + target.search + target.hash || '/'
  }
  catch {
    return '/'
  }
})

const loginHref = computed(() => `/auth/start/github?next=${encodeURIComponent(redirectPath.value)}`)

if (import.meta.server && !error.value && seededSession.value?.user && redirectPath.value !== '/auth/login') {
  await navigateTo(redirectPath.value, {
    redirectCode: 302,
    replace: true,
    external: true,
  })
}

// 核心逻辑：如果已经有 Session 且没有权限错误，则执行跳转
// 添加防抖，避免频繁触发
let redirectTimer: NodeJS.Timeout | null = null
watchEffect(() => {
  // 如果有权限错误，不自动跳转（避免无限循环）
  if (error.value) {
    return
  }

  if (session.value && !isPending.value && redirectPath.value !== '/auth/login') {
    // CR-01 修复：redirectPath 已经过最终同源校验，为 same-origin 相对路径，不再解码
    const target = redirectPath.value

    // 避免重定向到自己
    if (target === window.location.pathname || target === '/auth/login') {
      // eslint-disable-next-line no-console
      console.log('[Login] Already on target page, skipping redirect')
      return
    }

    // eslint-disable-next-line no-console
    console.log('[Login] Session detected, redirecting to:', target)

    // 清除之前的定时器
    if (redirectTimer) {
      clearTimeout(redirectTimer)
    }

    // 延迟跳转，避免 watchEffect 多次触发
    redirectTimer = setTimeout(() => {
      // target 已经是 same-origin 相对路径，直接跳转
      window.location.href = target
    }, 100)
  }
})

// WR-03 修复：组件销毁时清理定时器，避免异步跳转在路由切换后仍发生
onUnmounted(() => {
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
})
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
      <a
        :href="loginHref"
        class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl font-bold transition-all disabled:opacity-50 shadow-lg"
      >
        <Github class="w-6 h-6" />
        Login with GitHub
      </a>
    </div>

    <p class="text-[10px] text-muted-foreground uppercase tracking-widest">
      Protected by Better Auth
    </p>
  </div>
</template>
