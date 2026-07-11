import * as Sentry from '@sentry/nuxt'

const config = useRuntimeConfig()

if (config.public.sentryDsn) {
  Sentry.init({
    dsn: config.public.sentryDsn,
    environment: config.public.apiUrl.includes('localhost') ? 'development' : 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}
