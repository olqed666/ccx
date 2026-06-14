#!/usr/bin/env bun
/**
 * 一次性脚本：将桌面端 TS 内联翻译对象提取为 JSON 语言文件。
 * 合并 messages.ts 中的 static keys + preset-messages.ts 中的 EN preset keys。
 * 用法：bun run scripts/extract-i18n.ts
 */

// messages.ts 中导出了 messages 对象和 types
// 需要直接读取文件中的对象字面量——用 ts import
import { messages } from '../src/i18n/messages'
import { presetMessages } from '../src/i18n/preset-messages'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const outDir = resolve(__dirname, '../src/locales')
mkdirSync(outDir, { recursive: true })

// 提取 en：static keys + preset EN keys
const enData = {
  ...messages.en,
  ...presetMessages.en,
}

// 提取 zh-CN：static keys only（preset zh-CN 为空，fallback 到 Go）
const zhCNData = {
  ...messages['zh-CN'],
  ...presetMessages['zh-CN'],
}

const files = {
  'en.json': enData,
  'zh-CN.json': zhCNData,
}

for (const [filename, data] of Object.entries(files)) {
  const path = resolve(outDir, filename)
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  const count = Object.keys(data).length
  console.log(`✓ ${filename}: ${count} keys → ${path}`)
}
