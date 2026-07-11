import * as Sentry from '@sentry/vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
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

app.mount('#app')
