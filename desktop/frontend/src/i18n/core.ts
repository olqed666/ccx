import type { SupportedLocale } from './messages'

export const isSupportedLocale = (value?: string | null): value is SupportedLocale => {
  if (!value) return false
  const normalized = normalizeLocale(value)
  return normalized === 'en' || normalized === 'zh-CN'
}

export const normalizeLocale = (value?: string | null): SupportedLocale => {
  if (!value) return 'en'
  const normalized = value.replace(/_/g, '-')
  const lower = normalized.toLowerCase()
  if (lower === 'zh' || lower.startsWith('zh-')) {
    return 'zh-CN'
  }
  if (lower === 'en' || lower.startsWith('en-')) {
    return 'en'
  }
  return 'en'
}

export const resolveInitialLocale = (persistedLocale?: string | null, systemLocale?: string | null): SupportedLocale => {
  if (persistedLocale && isSupportedLocale(persistedLocale)) {
    return persistedLocale as SupportedLocale
  }
  return normalizeLocale(systemLocale)
}

export const applyDocumentLanguage = (locale: SupportedLocale) => {
  try {
    document.documentElement.lang = locale
  } catch {
    // SSR 或测试环境可忽略
  }
}
