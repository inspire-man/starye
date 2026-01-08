import locales from '@starye/locales'
import { createI18n } from 'vue-i18n'

const { zh, en } = locales

export default createI18n({
  legacy: false,
  locale: localStorage.getItem('starye_i18n') || 'zh',
  fallbackLocale: 'en',
  messages: {
    zh,
    en,
  },
})
