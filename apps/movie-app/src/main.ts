import * as Sentry from '@sentry/vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { enablePerformanceMonitoring } from './composables/usePerformanceMonitor'
import router from './router'
import { initGlobalErrorHandling } from './utils/monitoring'
import './style.css'

const app = createApp(App)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN

app.use(createPinia())
app.use(router)

if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    enabled: true,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
    ],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

// 初始化全局错误处理
initGlobalErrorHandling()

// 开发环境启用性能监控
if (import.meta.env.DEV || import.meta.env.VITE_FEATURE_PERF_MONITOR === 'true') {
  enablePerformanceMonitoring()
}

app.mount('#app')
