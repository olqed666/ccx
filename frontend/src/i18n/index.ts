import { useI18n as vueUseI18n } from 'vue-i18n'
import { computed } from 'vue'

import { usePreferencesStore } from '@/stores/preferences'

import {
  applyDocumentLanguage,
  getRuntimeLocale,
  normalizeLocale,
} from './core'

export {
  applyDocumentLanguage,
  DEFAULT_LOCALE,
  getDocumentLanguage,
  getRuntimeLocale,
  isSupportedLocale,
  normalizeLocale,
  resolveInitialLocale,
} from './core'
export type { SupportedLocale } from './messages'

export function useI18n() {
  const preferencesStore = usePreferencesStore()
  const vueI18n = vueUseI18n()

  const locale = computed(() => normalizeLocale(preferencesStore.uiLanguage as unknown as string))

  const t = (key: string, params?: Record<string, string | number>) => {
    return vueI18n.t(key, params as Record<string, string | number>) as string
  }

  const setLocale = (nextLocale: string) => {
    preferencesStore.setUILanguage(nextLocale as any)
    vueI18n.locale.value = nextLocale
    applyDocumentLanguage(nextLocale as any)
  }

  return {
    locale,
    t,
    setLocale,
  }
}

/**
 * 非组件上下文的翻译函数（供 store 等直接调用）。
 * 通过 vue-i18n 全局实例实现。
 */
export function translate(
  locale: string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const i18n = (globalThis as any).__CCX_I18N__
  if (!i18n) return key
  const prev = i18n.global.locale.value
  i18n.global.locale.value = locale
  const result = i18n.global.t(key, params as Record<string, string | number>) as string
  i18n.global.locale.value = prev
  return result
}
