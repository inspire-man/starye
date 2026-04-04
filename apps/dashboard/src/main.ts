import { createApp } from 'vue'
import App from './App.vue'
import { handleError } from './composables/useErrorHandler'
import i18n from './i18n'
import router from './router'
import './style.css'
import './styles/skeleton.css'

const app = createApp(App)

// 全局 Vue 错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error Handler]', {
    error: err,
    component: instance?.$options.name || 'Anonymous',
    info,
  })
  handleError(err, '组件渲染出错')
}

// 全局 Promise rejection 处理
window.onunhandledrejection = (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
  handleError(event.reason, 'Promise 执行失败')
}

app.use(router)
app.use(i18n)
app.mount('#app')
