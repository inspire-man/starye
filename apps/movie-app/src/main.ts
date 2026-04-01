import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { enablePerformanceMonitoring } from './composables/usePerformanceMonitor'
import router from './router'
import { initGlobalErrorHandling } from './utils/monitoring'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 初始化全局错误处理
initGlobalErrorHandling()

// 开发环境启用性能监控
if (import.meta.env.DEV || import.meta.env.VITE_FEATURE_PERF_MONITOR === 'true') {
  enablePerformanceMonitoring()
}

app.mount('#app')
