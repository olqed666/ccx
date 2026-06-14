#!/usr/bin/env bun
/**
 * 一次性脚本：将 TS 内联翻译对象提取为 JSON 语言文件。
 * 用法：bun run scripts/extract-i18n.ts
 */

import { enMessages } from '../src/i18n/messages-en'
import { zhCNMessages } from '../src/i18n/messages-zh-cn'
import { idMessages } from '../src/i18n/messages-id'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const outDir = resolve(__dirname, '../src/locales')
mkdirSync(outDir, { recursive: true })

const files = {
  'en.json': enMessages,
  'zh-CN.json': zhCNMessages,
  'id.json': idMessages,
}

for (const [filename, messages] of Object.entries(files)) {
  const path = resolve(outDir, filename)
  writeFileSync(path, JSON.stringify(messages, null, 2) + '\n', 'utf-8')
  const count = Object.keys(messages).length
  console.log(`✓ ${filename}: ${count} keys → ${path}`)
}
