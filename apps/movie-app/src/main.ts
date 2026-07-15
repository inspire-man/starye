import * as Sentry from '@sentry/vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { enablePerformanceMonitoring } from './composables/usePerformanceMonitor'
import { moviePublicRuntime } from './config/public-runtime'
import router from './router'
import { initGlobalErrorHandling } from './utils/monitoring'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

if (moviePublicRuntime.sentryDsn) {
  Sentry.init({
    app,
    dsn: moviePublicRuntime.sentryDsn,
    enabled: true,
    environment: moviePublicRuntime.buildMode,
    release: moviePublicRuntime.sentryRelease,
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
if (moviePublicRuntime.buildMode === 'development' || moviePublicRuntime.performanceMonitoringEnabled) {
  enablePerformanceMonitoring()
}

app.mount('#app')
