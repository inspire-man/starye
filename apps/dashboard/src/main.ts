import * as Sentry from '@sentry/vue'
import { createApp } from 'vue'
import App from './App.vue'
import { handleError } from './composables/useErrorHandler'
import { dashboardPublicRuntime } from './config/public-runtime'
import i18n from './i18n'
import router from './router'
import './style.css'
import './styles/skeleton.css'

const app = createApp(App)
const { buildMode, sentryDsn, sentryRelease } = dashboardPublicRuntime

// 全局 Vue 错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error Handler]', {
    error: err,
    component: instance?.$options.name || 'Anonymous',
    info,
  })
  if (sentryDsn) {
    Sentry.captureException(err, {
      tags: {
        app: 'dashboard',
        surface: 'vue',
      },
      extra: {
        component: instance?.$options.name || 'Anonymous',
        info,
      },
    })
  }
  handleError(err, '组件渲染出错')
}

// 全局 Promise rejection 处理
window.onunhandledrejection = (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
  if (sentryDsn) {
    Sentry.captureException(event.reason, {
      tags: {
        app: 'dashboard',
        surface: 'promise',
      },
    })
  }
  handleError(event.reason, 'Promise 执行失败')
}

if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    enabled: true,
    environment: buildMode,
    release: sentryRelease,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
    ],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

app.use(router)
app.use(i18n)
app.mount('#app')
