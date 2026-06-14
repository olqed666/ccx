// Type-only: 翻译数据已迁移到 src/locales/*.json
export type SupportedLocale = 'en' | 'zh-CN'

export const defaultLocale: SupportedLocale = 'en'

export const languageOptions: { locale: SupportedLocale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'zh-CN', label: '中文' },
]
