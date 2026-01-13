import locales from '@starye/locales'

const { en, zh } = locales

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'en',
  messages: {
    en: {
      ...en,
      welcome: 'Welcome to Blog',
      blog: {
        title: 'Blog',
      },
    },
    zh: {
      ...zh,
      welcome: '欢迎来到博客',
      blog: {
        title: '博客',
      },
    },
  },
}))
