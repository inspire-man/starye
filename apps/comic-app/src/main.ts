import * as Sentry from '@sentry/vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { comicPublicRuntime } from './config/public-runtime'
import router from './router'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

if (comicPublicRuntime.sentryDsn) {
  Sentry.init({
    app,
    dsn: comicPublicRuntime.sentryDsn,
    enabled: true,
    environment: comicPublicRuntime.buildMode,
    release: comicPublicRuntime.sentryRelease,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
    ],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

app.mount('#app')
