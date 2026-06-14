import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import zhCN from '@/locales/zh-CN.json'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, 'zh-CN': zhCN },
  missingWarn: false,
  fallbackWarn: false,
})

// 挂载到 globalThis 供非组件上下文的 translate/tf 使用
;(globalThis as any).__CCX_I18N__ = i18n

export default i18n
