<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useLanguage } from '@/composables/useLanguage'

interface HeaderRow {
  id: number
  key: string
  value: string
}

const props = defineProps<{
  headerRows: HeaderRow[]
  newHeader: HeaderRow
}>()

const emit = defineEmits<{
  'update:newHeader': [value: Partial<HeaderRow>]
  'addHeaderRow': []
  'removeHeaderRow': [id: number]
  'updateHeaderRow': [id: number, field: 'key' | 'value', value: string]
}>()

const { tf } = useLanguage()
</script>

<template>
  <section class="space-y-4 rounded-xl border border-border/60 bg-card/40 p-5 shadow-xs">
    <div class="border-b border-border/40 pb-2">
      <h4 class="text-xs font-bold uppercase tracking-wider text-primary">
        {{ tf('addChannel.customHeadersLabel', '自定义请求头 (可选)') }}
      </h4>
      <p class="mt-1 text-[10px] leading-4 text-muted-foreground">
        {{ tf('addChannel.customHeadersHint', '添加或覆盖发送到上游的 HTTP 请求头') }}
      </p>
    </div>

    <!-- 已有 Headers 列表 -->
    <div v-if="headerRows.length" class="space-y-2">
      <div class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-1">
        {{ tf('console.form.existingHeaders', '已配置标头') }}
      </div>
      <div
        v-for="row in headerRows"
        :key="row.id"
        class="flex items-start gap-2 p-2 rounded-lg border border-border/60 bg-background/60 hover:bg-background transition-colors"
      >
        <div class="grid flex-1 gap-2 md:grid-cols-[1fr_2fr]">
          <Input
            :model-value="row.key"
            class="h-9 font-mono text-xs"
            :placeholder="tf('addChannel.headerNameLabel', 'Header 名称')"
            @update:model-value="(val) => emit('updateHeaderRow', row.id, 'key', val as string)"
          />
          <Input
            :model-value="row.value"
            class="h-9 font-mono text-xs"
            :placeholder="tf('addChannel.headerValueLabel', '请求头值')"
            @update:model-value="(val) => emit('updateHeaderRow', row.id, 'value', val as string)"
          />
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          class="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10"
          @click="emit('removeHeaderRow', row.id)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- 添加新 Header -->
    <div>
      <Label class="text-xs font-semibold text-muted-foreground mb-2 block">
        {{ tf('console.form.addNewHeader', '添加新标头') }}
      </Label>
      <div class="grid gap-2 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <Input
          :model-value="newHeader.key"
          class="h-9 w-full font-mono text-xs"
          :placeholder="tf('addChannel.headerNameLabel', 'Header 名称')"
          @update:model-value="(val) => emit('update:newHeader', { key: val as string })"
          @keydown.enter.prevent="emit('addHeaderRow')"
        />
        <Input
          :model-value="newHeader.value"
          class="h-9 w-full font-mono text-xs"
          :placeholder="tf('addChannel.headerValueLabel', '请求头值')"
          @update:model-value="(val) => emit('update:newHeader', { value: val as string })"
          @keydown.enter.prevent="emit('addHeaderRow')"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="h-9 justify-self-start px-3.5 shadow-3xs md:justify-self-auto"
          :disabled="!newHeader.key.trim() || !newHeader.value.trim()"
          @click="emit('addHeaderRow')"
        >
          <Plus class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- 说明 -->
    <div class="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/30">
      <p class="font-semibold mb-1">{{ tf('console.form.headersNote', '说明') }}</p>
      <ul class="space-y-1 text-[11px] leading-relaxed">
        <li>• {{ tf('console.form.headersNoteInject', '自定义 Headers 将在每个请求中注入到上游') }}</li>
        <li>• {{ tf('console.form.headersNoteOverride', '支持覆盖默认 Headers（如 User-Agent、Authorization 等）') }}</li>
        <li>• {{ tf('console.form.headersNoteTemplate', '键名和值都支持模板变量（如果后端实现了变量替换）') }}</li>
      </ul>
    </div>
  </section>
</template>
