import DefaultTheme from 'vitepress/theme'
import RecommendedDownload from './components/RecommendedDownload.vue'

import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('RecommendedDownload', RecommendedDownload)
  },
} satisfies Theme
