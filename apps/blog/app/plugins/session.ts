/**
 * Phase 1 / AUTH-02 / D-04
 *
 * 把 SSR 阶段预取的 session 同步到 useState，供组件通过 useState('session') 直接读。
 * 客户端 hydrate 后 Better Auth 的 authClient.useSession() 会自行刷新，此 plugin 只消除首帧闪烁。
 */

export default defineNuxtPlugin({
  name: 'session-seed',
  enforce: 'pre',
  setup() {
    const session = useState<unknown>('session', () => null)
    if (import.meta.server) {
      const event = useRequestEvent()
      session.value = event?.context.session ?? null
    }
  },
})
