<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, X, List } from 'lucide-vue-next'
import { useAdminApi } from '@/composables/useAdminApi'
import { useLanguage } from '@/composables/useLanguage'
import type { ChannelLogEntry, ChannelLogsResponse } from '@/services/admin-api'

interface Props {
  open: boolean
  channelType: string
  channelId: number
  channelName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { tf } = useLanguage()
const api = useAdminApi()
const visibility = useDocumentVisibility()

const logs = ref<ChannelLogEntry[]>([])
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')
const expandedIndex = ref<number | null>(null)
const autoRefresh = ref(true)
let fetchPromise: Promise<void> | null = null

const shouldPoll = computed(() => props.open && autoRefresh.value && visibility.value === 'visible')

async function fetchLogs(options: { silent?: boolean } = {}) {
  if (!props.open || props.channelId < 0 || fetchPromise) return fetchPromise

  const silent = options.silent || logs.value.length > 0
  if (silent) refreshing.value = true
  else loading.value = true
  error.value = ''

  fetchPromise = api.get<ChannelLogsResponse>(`/api/${props.channelType}/channels/${props.channelId}/logs`)
    .then(data => {
      logs.value = data.logs || []
    })
    .catch(e => {
      error.value = e instanceof Error ? e.message : String(e)
    })
    .finally(() => {
      loading.value = false
      refreshing.value = false
      fetchPromise = null
    })

  return fetchPromise
}

function toggleExpand(index: number) {
  expandedIndex.value = expandedIndex.value === index ? null : index
}

function statusColorClass(code: number) {
  if (code >= 200 && code < 300) return 'border-emerald-500 bg-emerald-500 text-white'
  if (code >= 400 && code < 500) return 'border-amber-500 bg-amber-500 text-white'
  return 'border-rose-500 bg-rose-500 text-white'
}

function requestStatusClass(status: string) {
  switch (status) {
    case 'completed': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'failed': return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
    case 'cancelled':
    case 'canceled': return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'streaming': return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
    case 'first_byte': return 'border-primary/30 bg-primary/10 text-primary'
    case 'connecting': return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'pending': return 'border-border bg-muted/30 text-muted-foreground'
    default: return 'border-border bg-muted/30 text-muted-foreground'
  }
}

function requestStatusText(status: string) {
  switch (status) {
    case 'pending': return tf('channelLogs.status.pending', '等待中')
    case 'connecting': return tf('channelLogs.status.connecting', '连接中')
    case 'first_byte': return tf('channelLogs.status.firstByte', '首字节')
    case 'streaming': return tf('channelLogs.status.streaming', '流式传输')
    case 'completed': return tf('channelLogs.status.completed', '已完成')
    case 'failed': return tf('channelLogs.status.failed', '失败')
    case 'cancelled':
    case 'canceled': return tf('channelLogs.status.cancelled', '已取消')
    default: return status || '—'
  }
}

function isInProgress(status: string) {
  return ['pending', 'connecting', 'first_byte', 'streaming'].includes(status)
}

function interfaceTypeClass(type: string) {
  switch (type.toLowerCase()) {
    case 'messages': return 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300'
    case 'chat': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'responses': return 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300'
    case 'gemini': return 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300'
    case 'images': return 'border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300'
    default: return 'border-border bg-muted/30 text-muted-foreground'
  }
}

function calculateDurations(log: ChannelLogEntry) {
  if (!log.startTime) return null

  const start = new Date(log.startTime).getTime()
  if (!Number.isFinite(start)) return null
  const connected = log.connectedAt ? new Date(log.connectedAt).getTime() : null
  const firstByte = log.firstByteAt ? new Date(log.firstByteAt).getTime() : null
  const completed = log.completedAt ? new Date(log.completedAt).getTime() : null

  return {
    connectMs: connected && Number.isFinite(connected) ? connected - start : null,
    firstByteMs: firstByte && Number.isFinite(firstByte) ? firstByte - start : null,
    totalMs: completed && Number.isFinite(completed) ? completed - start : null,
  }
}

function formatDurationSeconds(durationMs: number) {
  const seconds = durationMs / 1000
  return `${Number.parseFloat(seconds.toPrecision(3))}s`
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}

const { pause, resume } = useIntervalFn(() => {
  if (shouldPoll.value) fetchLogs({ silent: true })
}, 3000, { immediate: false })

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    logs.value = []
    expandedIndex.value = null
    resume()
    void fetchLogs()
  } else {
    pause()
  }
})

watch([() => props.channelId, () => props.channelType], () => {
  if (!props.open) return
  logs.value = []
  expandedIndex.value = null
  void fetchLogs()
})

watch(shouldPoll, (polling) => {
  if (polling) resume()
  else pause()
})

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @keydown="onKeyDown"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

        <div class="relative z-10 flex max-h-[85vh] w-[90vw] max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
          <div class="flex shrink-0 items-center justify-between border-b border-border p-4">
            <div class="flex min-w-0 items-center gap-2">
              <h3 class="truncate text-sm font-semibold">
                {{ tf('channelLogs.title', '频道日志') }}: {{ channelName }}
              </h3>
              <Badge variant="secondary" class="text-[10px]">
                {{ logs.length }} {{ tf('console.logs.entries', '条') }}
              </Badge>
              <Badge v-if="refreshing" variant="outline" class="text-[10px]">
                <Loader2 class="h-3 w-3 animate-spin" />
                {{ tf('common.refreshing', '刷新中') }}
              </Badge>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" :disabled="loading || refreshing" @click="fetchLogs()">
                <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading || refreshing }" />
              </Button>
              <Button variant="ghost" size="icon-sm" @click="emit('close')" class="relative group">
                <X class="h-4 w-4" />
                <span class="absolute -bottom-6 right-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Esc</span>
              </Button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-hidden">
            <div v-if="loading && logs.length === 0" class="space-y-2 p-4">
              <Skeleton v-for="i in 5" :key="i" class="h-14 w-full" />
            </div>

            <div v-else-if="error" class="p-4 text-sm text-destructive">
              {{ error }}
            </div>

            <div v-else-if="logs.length === 0" class="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <List class="h-10 w-10" />
              {{ tf('channelLogs.empty', '暂无日志') }}
            </div>

            <ScrollArea v-else class="h-full">
              <div class="divide-y divide-border">
                <div
                  v-for="(log, index) in logs"
                  :key="log.requestId || index"
                  class="cursor-pointer px-4 py-3 transition-colors hover:bg-accent/40"
                  :class="{ 'bg-destructive/5': log.status === 'failed' }"
                  @click="toggleExpand(index)"
                >
                  <div class="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      v-if="log.statusCode > 0"
                      class="inline-flex min-w-10 justify-center border px-2 py-0.5 font-mono font-bold text-white"
                      :class="statusColorClass(log.statusCode)"
                    >
                      {{ log.statusCode }}
                    </span>
                    <span
                      v-else-if="isInProgress(log.status)"
                      class="inline-flex min-w-10 justify-center border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary"
                    >
                      000
                    </span>
                    <span v-else class="inline-flex min-w-10 justify-center border border-border bg-muted/30 px-2 py-0.5 font-mono font-bold text-muted-foreground">-</span>

                    <span class="text-muted-foreground">{{ formatTime(log.timestamp) }}</span>
                    <span v-if="log.status" class="inline-flex border px-1.5 py-0.5 text-[10px] font-bold uppercase" :class="requestStatusClass(log.status)">
                      {{ requestStatusText(log.status) }}
                    </span>
                    <span v-if="log.interfaceType" class="inline-flex border px-1.5 py-0.5 text-[10px] font-bold uppercase" :class="interfaceTypeClass(log.interfaceType)">
                      {{ log.interfaceType }}
                    </span>
                    <span v-if="log.operation" class="inline-flex border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-700 dark:text-cyan-300">
                      {{ log.operation }}
                    </span>
                    <span v-if="log.requestSource === 'capability_test'" class="inline-flex border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      {{ tf('channelLogs.sourceCapabilityTest', '能力测试') }}
                    </span>
                    <span v-if="log.originalModel" class="text-muted-foreground">{{ log.originalModel }} →</span>
                    <span class="font-medium">{{ log.model }}</span>
                    <code class="max-w-[130px] truncate bg-secondary px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{{ log.keyMask }}</code>
                    <code v-if="log.baseUrl" class="max-w-[220px] truncate bg-secondary px-1 py-0.5 font-mono text-[10px] text-muted-foreground" :title="log.baseUrl">
                      {{ log.baseUrl }}
                    </code>
                    <span v-if="log.isRetry" class="inline-flex border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      {{ tf('channelLogs.retry', '重试') }}
                    </span>
                    <template v-if="calculateDurations(log)">
                      <span v-if="calculateDurations(log)!.connectMs !== null" class="text-muted-foreground">
                        {{ tf('channelLogs.duration.connect', '连接') }} {{ formatDurationSeconds(calculateDurations(log)!.connectMs!) }}
                      </span>
                      <span v-if="calculateDurations(log)!.firstByteMs !== null" class="text-muted-foreground">
                        {{ tf('channelLogs.duration.firstByte', '首字节') }} {{ formatDurationSeconds(calculateDurations(log)!.firstByteMs!) }}
                      </span>
                      <span v-if="calculateDurations(log)!.totalMs !== null" class="text-muted-foreground">
                        {{ tf('channelLogs.duration.total', '总耗时') }} {{ formatDurationSeconds(calculateDurations(log)!.totalMs!) }}
                      </span>
                    </template>
                    <span v-else class="text-muted-foreground">{{ formatDurationSeconds(log.durationMs) }}</span>
                  </div>

                  <div v-if="expandedIndex === index && log.errorInfo" class="mt-2 border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                    {{ log.errorInfo }}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
