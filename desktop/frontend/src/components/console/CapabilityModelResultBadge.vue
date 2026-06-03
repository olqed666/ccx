<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, CheckCircle2, XCircle, ArrowRight, Clock } from 'lucide-vue-next'
import { useLanguage } from '@/composables/useLanguage'
import type { CapabilityProtocolJobResult, CapabilityModelJobResult } from '@/services/admin-api'

interface Props {
  test: CapabilityProtocolJobResult
  pendingText?: string
  retryEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pendingText: '',
  retryEnabled: true,
})

const emit = defineEmits<{
  retryModel: [protocol: string, model: string]
}>()

const { tf } = useLanguage()

const modelResults = computed(() => props.test.modelResults ?? [])

// 是否显示 pending placeholder
const shouldShowPendingPlaceholder = computed(() => {
  if (modelResults.value.length > 0) return false
  const s = props.test.status
  return s === 'running' || s === 'queued'
})

// 是否显示"details unavailable"
const shouldShowDetailsUnavailable = computed(() => {
  if (modelResults.value.length > 0) return false
  if (shouldShowPendingPlaceholder.value) return false
  return true
})

function getModelStatusIcon(status: string) {
  if (status === 'success') return CheckCircle2
  if (status === 'failed') return XCircle
  if (status === 'running' || status === 'queued') return Loader2
  return Clock
}

function getModelBadgeClasses(result: CapabilityModelJobResult) {
  const base = 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono cursor-default select-none'
  if (result.status === 'success') return `${base} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20`
  if (result.status === 'failed') {
    const retry = props.retryEnabled && canRetry(result)
    return `${base} bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20 ${retry ? 'cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/10' : ''}`
  }
  if (result.status === 'running') return `${base} bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20`
  if (result.status === 'queued') return `${base} bg-muted/30 text-muted-foreground border border-border`
  // idle / skipped / cancelled
  return `${base} bg-muted/20 text-muted-foreground border border-border`
}

function canRetry(result: CapabilityModelJobResult) {
  return result.status === 'failed' || result.status === 'idle'
}

function isRedirected(result: CapabilityModelJobResult) {
  return result.actualModel && result.actualModel !== result.model
}

function getModelTooltipView(result: CapabilityModelJobResult) {
  if (result.status === 'success') return 'success'
  if (result.status === 'running' || result.status === 'queued') return 'pending'
  return 'failed'
}

function formatStreaming(result: CapabilityModelJobResult) {
  if (result.streamingSupported === true) return tf('capability.supported', 'Yes')
  if (result.streamingSupported === false) return tf('capability.unsupported', 'No')
  return '—'
}

function getModelTooltipLatencyText(result: CapabilityModelJobResult) {
  return result.latency >= 0 ? `${result.latency}ms` : '—'
}

function handleBadgeClick(result: CapabilityModelJobResult) {
  if (canRetry(result) && props.retryEnabled) {
    emit('retryModel', props.test.protocol, result.model)
  }
}
</script>

<template>
  <div>
    <!-- pending placeholder -->
    <div v-if="shouldShowPendingPlaceholder" class="flex items-center gap-2 py-2">
      <Loader2 class="h-4 w-4 animate-spin text-primary" />
      <span class="text-xs text-muted-foreground">{{ pendingText || tf('capability.modelQueued', '模型排队中...') }}</span>
    </div>

    <!-- details unavailable -->
    <div v-else-if="shouldShowDetailsUnavailable" class="py-1 text-xs text-muted-foreground">
      {{ tf('capability.modelDetailsUnavailable', '模型详情暂不可用') }}
    </div>

    <!-- model badges -->
    <div v-else class="flex flex-wrap gap-1.5 py-1">
      <div
        v-for="result in modelResults"
        :key="`${test.protocol}-${result.model}`"
        :class="getModelBadgeClasses(result)"
        :title="getModelTooltipView(result) === 'success'
          ? `${result.model}${result.actualModel && result.actualModel !== result.model ? ` → ${result.actualModel}` : ''} | ${getModelTooltipLatencyText(result)} | Streaming: ${formatStreaming(result)}`
          : getModelTooltipView(result) === 'pending'
          ? `${result.model} — ${result.status}`
          : `${result.model}${result.error ? ` — ${result.error}` : ''}${canRetry(result) ? ` | ${tf('capability.retryModel', '重试')}` : ''}`"
        @click="handleBadgeClick(result)"
      >
        <span>{{ result.model }}</span>
        <ArrowRight v-if="isRedirected(result)" class="h-3 w-3 text-muted-foreground" />
        <component
          :is="getModelStatusIcon(result.status)"
          class="h-3 w-3"
          :class="{ 'animate-spin': result.status === 'running' }"
        />
      </div>
    </div>
  </div>
</template>