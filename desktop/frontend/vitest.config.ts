import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@bindings': path.resolve(__dirname, './bindings'),
    },
  },
  test: {
    environment: 'jsdom',
  },
})
