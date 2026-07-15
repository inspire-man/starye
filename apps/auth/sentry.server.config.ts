import * as Sentry from '@sentry/nuxt'

const config = useRuntimeConfig()

if (config.public.sentryDsn) {
  Sentry.init({
    dsn: config.public.sentryDsn,
    environment: config.public.buildMode,
    release: config.public.sentryRelease,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    enableNitroErrorHandler: true,
  })
}
