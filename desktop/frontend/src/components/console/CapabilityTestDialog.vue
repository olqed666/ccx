<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, X, Play, Square, ArrowRight, CheckCircle2, XCircle, Clock, Gauge } from 'lucide-vue-next'
import { useCapabilityTests } from '@/composables/useCapabilityTests'
import { useLanguage } from '@/composables/useLanguage'
import CapabilityModelResultBadge from '@/components/console/CapabilityModelResultBadge.vue'
import type { CapabilityProtocolJobResult } from '@/services/admin-api'

interface Props {
  open: boolean
  channelType: string
  channelId: number
  channelName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'copyToTab', targetProtocol: string, serviceProtocol: string): void
}>()

const { tf } = useLanguage()
const {
  activeJob,
  snapshot,
  loading,
  polling,
  cancelling,
  error,
  startTest,
  startProtocolTest,
  fetchSnapshot,
  cancelTest,
  retryModelForProtocol,
  copyToTab,
  reset,
  protocolResults,
  compatibleProtocols,
  lifecycle,
  outcome,
  isActive,
  state,
} = useCapabilityTests()

const isStarting = ref(false)
const rpmValue = ref(10)

// 加载 snapshot
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await fetchSnapshot(props.channelType, props.channelId)
  } else {
    reset()
  }
})

const currentJob = computed(() => activeJob.value)
const progress = computed(() => currentJob.value?.progress)

const progressPercent = computed(() => {
  if (!progress.value || !progress.value.totalModels) return 0
  return Math.round((progress.value.completedModels / progress.value.totalModels) * 100)
})

const runMode = computed(() => currentJob.value?.runMode ?? 'fresh')
const displayOutcome = computed(() => outcome.value)
const hasNoCompatibleProtocolsYet = computed(() => compatibleProtocols.value.length === 0)

// ── 协议排序 ──

const PROTOCOL_ORDER = ['messages', 'responses', 'chat', 'gemini']

function sortProtocolOrder(proto: string): number {
  if (proto.includes('->')) return 0
  const idx = PROTOCOL_ORDER.indexOf(proto)
  return idx >= 0 ? idx + 1 : PROTOCOL_ORDER.length + 1
}

const sortedTests = computed(() => {
  return [...protocolResults.value].sort((a, b) => sortProtocolOrder(a.protocol) - sortProtocolOrder(b.protocol))
})

// ── 协议显示名/颜色 ──

const PROTOCOL_COLORS: Record<string, string> = {
  messages: 'text-orange-600 dark:text-orange-400 bg-orange-500/15 border-orange-500/20',
  chat: 'text-primary bg-primary/15 border-primary/20',
  responses: 'text-teal-600 dark:text-teal-400 bg-teal-500/15 border-teal-500/20',
  gemini: 'text-purple-600 dark:text-purple-400 bg-purple-500/15 border-purple-500/20',
}

function getProtocolColor(proto: string): string {
  if (proto.includes('->')) return 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/15 border-cyan-500/20'
  return PROTOCOL_COLORS[proto] ?? 'text-muted-foreground bg-muted/30 border-border'
}

function getProtocolDisplayName(proto: string): string {
  const map: Record<string, string> = { messages: 'Messages', chat: 'Chat', responses: 'Responses', gemini: 'Gemini' }
  if (proto.includes('->')) {
    const parts = proto.split('->')
    return `${map[parts[0]] ?? parts[0]} → ${map[parts[1]] ?? parts[1]}`
  }
  return map[proto] ?? proto
}

// ── 协议状态判定 ──

function isProtocolBusy(test: CapabilityProtocolJobResult): boolean {
  return test.status === 'running' || test.status === 'queued'
}

function isProtocolFailed(test: CapabilityProtocolJobResult): boolean {
  return test.status === 'failed'
}

function shouldShowTestProtocolButton(test: CapabilityProtocolJobResult): boolean {
  return test.status === 'idle' || test.status === 'failed'
}

function isCurrentTabProtocol(proto: string): boolean {
  const map: Record<string, string> = { messages: 'messages', chat: 'chat', responses: 'responses', gemini: 'gemini', images: 'images' }
  return proto === (map[props.channelType] ?? props.channelType)
}

function getSuccessfulProtocols(): string[] {
  return sortedTests.value.filter(t => t.success).map(t => t.protocol)
}

// ── 表格指标 ──

function getSuccessCount(test: CapabilityProtocolJobResult): number {
  return (test.modelResults ?? []).filter(m => m.status === 'success').length
}

function getAttemptedModels(test: CapabilityProtocolJobResult): number {
  return (test.modelResults ?? []).filter(m => m.status !== 'idle' && m.status !== 'skipped').length
}

function formatSuccessRatio(test: CapabilityProtocolJobResult): string {
  const s = getSuccessCount(test)
  const a = getAttemptedModels(test)
  if (a === 0) return '—'
  return `${s}/${a}`
}

function getAverageLatency(test: CapabilityProtocolJobResult): string {
  const results = (test.modelResults ?? []).filter(m => m.status === 'success' && m.latency >= 0)
  if (!results.length) return '—'
  const avg = Math.round(results.reduce((sum, m) => sum + m.latency, 0) / results.length)
  return `${avg}ms`
}

function hasProtocolLatency(test: CapabilityProtocolJobResult): boolean {
  return (test.modelResults ?? []).some(m => m.latency >= 0)
}

// ── Actions ──

async function handleStart() {
  isStarting.value = true
  try {
    await startTest(props.channelType, props.channelId, { rpm: rpmValue.value })
  } finally {
    isStarting.value = false
  }
}

async function handleTestProtocol(protocol: string) {
  isStarting.value = true
  try {
    await startProtocolTest(props.channelType, props.channelId, protocol, undefined, rpmValue.value)
  } finally {
    isStarting.value = false
  }
}

async function handleCancel() {
  if (!currentJob.value?.protocolJobRefs) return
  for (const [, ref] of Object.entries(currentJob.value.protocolJobRefs)) {
    if (ref.jobId) {
      await cancelTest(props.channelType, props.channelId, ref.jobId)
    }
  }
  await fetchSnapshot(props.channelType, props.channelId)
}

async function handleRetryModel(protocol: string, model: string) {
  await retryModelForProtocol(props.channelType, props.channelId, protocol, model)
}

function handleCopyToTab(targetProtocol: string, serviceProtocol: string) {
  void copyToTab(props.channelType, props.channelId, targetProtocol)
}

function handleRpmBlur() {
  if (rpmValue.value < 1) rpmValue.value = 1
  if (rpmValue.value > 60) rpmValue.value = 60
}

function getRunModeLabel(mode: string): string {
  const map: Record<string, string> = {
    fresh: '',
    reused_running: tf('capability.runMode.reusedRunning', '复用运行'),
    resumed_cancelled: tf('capability.runMode.resumedCancelled', '恢复取消'),
    cache_hit: tf('capability.runMode.cacheHit', '缓存命中'),
    reused_previous_results: tf('capability.runMode.reusedPrevious', '复用上次结果'),
  }
  return map[mode] ?? mode
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onBeforeUnmount(() => {
  reset()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center" @keydown="onKeyDown">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

        <div class="relative z-10 w-[94vw] max-w-4xl max-h-[90vh] border border-border bg-card shadow-2xl flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
            <div class="flex items-center gap-2">
              <Play class="h-4 w-4 text-primary" />
              <h3 class="text-sm font-semibold">
                {{ tf('capability.title', '能力测试') }}: {{ channelName }}
              </h3>
            </div>
            <div class="flex items-center gap-2">
              <Badge v-if="runMode !== 'fresh'" variant="secondary" class="text-[10px]">{{ getRunModeLabel(runMode) }}</Badge>
              <Badge v-if="displayOutcome === 'partial'" variant="outline" class="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-400">{{ tf('capability.partial', '部分成功') }}</Badge>
              <Badge v-else-if="displayOutcome === 'cancelled'" variant="outline" class="text-[10px]">{{ tf('capability.cancelled', '已取消') }}</Badge>
              <Button variant="ghost" size="icon-sm" @click="emit('close')"><X class="h-4 w-4" /></Button>
            </div>
          </div>

          <!-- Body -->
          <ScrollArea class="flex-1 min-h-0">
            <div class="p-4 space-y-4">
              <!-- Error -->
              <div v-if="error" class="text-sm text-destructive bg-destructive/10 p-3">{{ error }}</div>

              <!-- Initializing -->
              <div v-if="state === 'initializing'" class="flex flex-col items-center py-8 gap-3">
                <Loader2 class="h-8 w-8 animate-spin text-primary" />
                <p class="text-sm text-muted-foreground">{{ tf('capability.loadingTitle', '正在测试协议兼容性...') }}</p>
              </div>

              <!-- 状态栏 -->
              <div v-if="state !== 'initializing' && state !== 'error'" class="flex items-center gap-2 flex-wrap border border-border bg-secondary/30 px-3 py-2">
                <Badge v-for="proto in compatibleProtocols" :key="proto" variant="outline" :class="['text-[10px]', getProtocolColor(proto)]">{{ getProtocolDisplayName(proto) }}</Badge>
                <Badge v-if="hasNoCompatibleProtocolsYet && (state === 'completed' || state === 'cancelled')" variant="outline" class="text-[10px] text-muted-foreground">{{ tf('capability.noCompatibleProtocols', '无兼容协议') }}</Badge>
                <div v-else-if="hasNoCompatibleProtocolsYet && state !== 'idle'" class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Loader2 v-if="state === 'pending' || state === 'running'" class="h-3 w-3 animate-spin text-primary" />
                  <span>{{ state === 'pending' ? tf('capability.modelQueued', '模型排队中') : tf('capability.protocolRunning', '协议测试中') }}</span>
                </div>

                <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground ml-auto">
                  <Gauge class="h-3 w-3" />
                  <span>{{ tf('capability.rpmLabel', 'RPM') }}</span>
                  <Input v-model.number="rpmValue" type="number" min="1" max="60" step="1" class="h-6 w-14 text-[11px] font-mono px-1.5" @blur="handleRpmBlur" />
                </div>

                <span v-if="progress?.totalModels && isActive" class="text-[10px] text-muted-foreground">
                  {{ progress?.completedModels || 0 }}/{{ progress?.totalModels || 0 }} {{ tf('capability.models', '模型') }}
                </span>

                <Button v-if="state === 'pending' || state === 'running'" variant="destructive" size="sm" :disabled="cancelling" @click="handleCancel">
                  <Square class="h-3 w-3 mr-1" />
                  {{ cancelling ? tf('capability.cancelling', '取消中...') : tf('capability.cancel', '取消') }}
                </Button>
              </div>

              <!-- 进度条 -->
              <div v-if="isActive && currentJob">
                <Progress :model-value="progressPercent" />
              </div>

              <!-- 无任务 -->
              <div v-if="state === 'idle' && !isActive" class="flex flex-col items-center py-6 gap-3">
                <p v-if="protocolResults.length > 0" class="text-sm text-muted-foreground">{{ tf('capability.lastResults', '上次测试结果') }}</p>
                <p v-else class="text-sm text-muted-foreground">{{ tf('capability.noResults', '尚未进行能力测试') }}</p>
                <Button :disabled="isStarting" @click="handleStart">
                  <Loader2 v-if="isStarting" class="h-4 w-4 mr-2 animate-spin" />
                  <Play v-else class="h-4 w-4 mr-2" />
                  {{ tf('capability.startTest', '开始测试') }}
                </Button>
              </div>

              <!-- 协议表格 -->
              <div v-if="sortedTests.length > 0 && state !== 'idle'" class="border border-border overflow-hidden">
                <table class="w-full text-xs">
                  <thead class="bg-secondary/40 border-b border-border">
                    <tr>
                      <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">{{ tf('capability.table.protocol', '协议') }}</th>
                      <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">{{ tf('capability.table.status', '状态') }}</th>
                      <th class="px-3 py-2 text-center font-semibold uppercase tracking-wider text-muted-foreground">{{ tf('capability.table.successCount', '成功') }}</th>
                      <th class="px-3 py-2 text-right font-semibold uppercase tracking-wider text-muted-foreground">{{ tf('capability.table.latency', '延迟') }}</th>
                      <th class="px-3 py-2 text-center font-semibold uppercase tracking-wider text-muted-foreground">{{ tf('capability.table.streaming', 'SSE') }}</th>
                      <th class="px-3 py-2 text-right font-semibold uppercase tracking-wider text-muted-foreground">{{ tf('capability.table.actions', '操作') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="test in sortedTests" :key="test.protocol">
                      <tr class="border-b border-border hover:bg-secondary/20">
                        <td class="px-3 py-2">
                          <Badge variant="outline" :class="['text-[10px]', getProtocolColor(test.protocol)]">{{ getProtocolDisplayName(test.protocol) }}</Badge>
                        </td>
                        <td class="px-3 py-2">
                          <div v-if="!isProtocolFailed(test)" class="flex items-center gap-1.5">
                            <CheckCircle2 v-if="test.success" class="h-3.5 w-3.5 text-emerald-500" />
                            <XCircle v-else-if="test.status === 'failed'" class="h-3.5 w-3.5 text-rose-500" />
                            <Loader2 v-else-if="isProtocolBusy(test)" class="h-3.5 w-3.5 animate-spin text-primary" />
                            <Clock v-else class="h-3.5 w-3.5 text-muted-foreground" />
                            <span class="text-xs">{{ test.status }}</span>
                          </div>
                          <div v-else class="flex items-center gap-1.5 text-rose-600 dark:text-rose-400" :title="test.error">
                            <XCircle class="h-3.5 w-3.5" />
                            <span class="text-xs truncate max-w-[180px]">{{ test.error || test.status }}</span>
                          </div>
                        </td>
                        <td class="px-3 py-2 text-center">
                          <span :class="getSuccessCount(test) === getAttemptedModels(test) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">{{ formatSuccessRatio(test) }}</span>
                        </td>
                        <td class="px-3 py-2 text-right font-mono">
                          <span v-if="hasProtocolLatency(test)">{{ getAverageLatency(test) }}</span>
                          <span v-else class="text-muted-foreground">—</span>
                        </td>
                        <td class="px-3 py-2 text-center">
                          <div v-if="test.success && test.streamingSupported" class="flex items-center justify-center gap-1">
                            <CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" /><span class="text-emerald-600 dark:text-emerald-400">{{ tf('capability.supported', '支持') }}</span>
                          </div>
                          <div v-else-if="test.success" class="flex items-center justify-center gap-1">
                            <XCircle class="h-3.5 w-3.5 text-amber-500" /><span class="text-amber-600 dark:text-amber-400">{{ tf('capability.unsupported', '不支持') }}</span>
                          </div>
                          <span v-else class="text-muted-foreground">—</span>
                        </td>
                        <td class="px-3 py-2 text-right">
                          <div class="flex items-center justify-end gap-1 flex-wrap">
                            <Button v-if="shouldShowTestProtocolButton(test)" variant="outline" size="sm" class="h-5 text-[10px]" :disabled="isActive || isStarting" @click="handleTestProtocol(test.protocol)">
                              <Play class="h-3 w-3" />{{ tf('capability.startTest', '开始测试') }}
                            </Button>
                            <Button v-if="test.success && !isCurrentTabProtocol(test.protocol)" variant="outline" size="sm" class="h-5 text-[10px]" @click="handleCopyToTab(test.protocol, test.protocol)">
                              <ArrowRight class="h-3 w-3" />{{ tf('capability.copyToTab', '复制到当前 Tab') }}
                            </Button>
                            <Badge v-else-if="isCurrentTabProtocol(test.protocol)" variant="secondary" class="text-[10px]">{{ tf('capability.currentTab', '当前 Tab') }}</Badge>
                            <template v-else-if="!test.success && !isCurrentTabProtocol(test.protocol)">
                              <Button v-for="successProto in getSuccessfulProtocols()" :key="successProto" variant="outline" size="sm" :class="['h-5 text-[10px]', getProtocolColor(successProto)]" @click="handleCopyToTab(test.protocol, successProto)">
                                {{ tf('capability.convert', '转换') }} → {{ getProtocolDisplayName(successProto) }}
                              </Button>
                            </template>
                          </div>
                        </td>
                      </tr>
                      <tr class="border-b border-border/50 bg-background/30">
                        <td colspan="6" class="px-3 py-2">
                          <CapabilityModelResultBadge :test="test" :pending-text="tf('capability.modelQueued', '模型排队中')" :retry-enabled="!isProtocolBusy(test)" @retry-model="handleRetryModel" />
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>

              <!-- 总耗时 -->
              <div v-if="currentJob?.totalDuration || snapshot?.totalDuration" class="text-xs text-muted-foreground text-right">
                {{ tf('capability.duration', '总耗时') }}: {{ ((currentJob?.totalDuration || snapshot?.totalDuration || 0) / 1000).toFixed(1) }}s
              </div>
            </div>
          </ScrollArea>
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