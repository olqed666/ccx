import { ref } from 'vue'
import { applyDocumentLanguage, resolveInitialLocale, translate as coreTranslate, translateOrFallback as coreTranslateFallback } from '@/i18n/core'
import type { MessageKey, SupportedLocale } from '@/i18n/messages'
import { defaultLocale, languageOptions } from '@/i18n/messages'
import {
  GetLanguagePreference,
  SaveLanguagePreference,
} from '@bindings/github.com/BenedictKing/ccx/desktop/desktopservice'

const locale = ref<SupportedLocale>(defaultLocale)
const languageReady = ref(false)
let initPromise: Promise<void> | null = null

export const useLanguage = () => {
  const t = (key: MessageKey, params?: Record<string, string>) => coreTranslate(locale.value, key, params)
  const tf = (key: string, fallback: string, params?: Record<string, string>) =>
    coreTranslateFallback(locale.value, key, fallback, params)

  const initializeLanguage = async () => {
    if (initPromise) {
      return initPromise
    }
    initPromise = (async () => {
      try {
        const preference = await GetLanguagePreference()
        locale.value = resolveInitialLocale(preference.locale, preference.systemLocale)
      } catch {
        locale.value = defaultLocale
      } finally {
        applyDocumentLanguage(locale.value)
        languageReady.value = true
      }
    })()
    return initPromise
  }

  const setLanguage = async (next: SupportedLocale) => {
    locale.value = next
    applyDocumentLanguage(next)
    try {
      await SaveLanguagePreference(next)
    } catch {
      // Wails API 失败不阻断 UI 切换
    }
  }

  return {
    locale,
    languageReady,
    languageOptions,
    initializeLanguage,
    setLanguage,
    t,
    tf,
  }
}
