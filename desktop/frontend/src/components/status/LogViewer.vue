<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { Terminal, Copy, Trash2, Search, ArrowDown, X } from 'lucide-vue-next'
import { useStatus } from '@/composables/useStatus'
import { useLanguage } from '@/composables/useLanguage'

const props = defineProps<{
  logs: string[]
}>()

const { status } = useStatus()
const { t } = useLanguage()
const searchQuery = ref('')
const terminalBody = ref<HTMLDivElement | null>(null)
const autoScroll = ref(true)
const copySuccess = ref(false)

// 过滤日志行
const filteredLogs = computed(() => {
  if (!searchQuery.value.trim()) return props.logs
  const query = searchQuery.value.toLowerCase()
  return props.logs.filter(log => log.toLowerCase().includes(query))
})

// 解析和高亮日志行
const parseLogLine = (line: string) => {
  if (!line) return { type: 'normal', time: '', component: '', action: '', msg: line }

  // 标准格式例如: 2026/05/20 14:03:04 [Scheduler-Channel] 选择渠道: xxxx
  const logRegex = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s+\[([^\]]+)\]\s+(.*)$/
  const match = line.match(logRegex)

  if (!match) {
    if (line.includes('ERROR') || line.includes('FAIL') || line.includes('err=') || line.includes('error=')) {
      return { type: 'error', time: '', component: '', action: '', msg: line }
    }
    if (line.includes('WARN')) {
      return { type: 'warn', time: '', component: '', action: '', msg: line }
    }
    return { type: 'normal', time: '', component: '', action: '', msg: line }
  }

  const [_, time, tag, rest] = match
  let type = 'normal'
  if (line.includes('ERROR') || line.includes('FAIL') || line.includes('失败')) {
    type = 'error'
  } else if (line.includes('WARN')) {
    type = 'warn'
  } else if (line.includes('SUCCESS') || line.includes('成功') || line.includes('healthy')) {
    type = 'success'
  }

  let component = tag
  let action = ''
  if (tag.includes('-')) {
    const parts = tag.split('-')
    component = parts[0]
    action = parts.slice(1).join('-')
  }

  return { type, time, component, action, msg: rest }
}

// 预先映射解析过滤后的日志数组以提高渲染效能，避免 template 中使用未支持的 v-let 指令
const parsedLogs = computed(() => {
  return filteredLogs.value.map((line, id) => {
    return {
      id,
      raw: line,
      parsed: parseLogLine(line)
    }
  })
})

// 平滑滚动到底部
const scrollToBottom = (force = false) => {
  if (!terminalBody.value) return
  if (autoScroll.value || force) {
    nextTick(() => {
      if (terminalBody.value) {
        terminalBody.value.scrollTo({
          top: terminalBody.value.scrollHeight,
          behavior: 'smooth'
        })
      }
    })
  }
}

// 监听日志变化自动滚动（受 autoScroll 开关控制）
watch(() => props.logs.length, () => {
  scrollToBottom()
})

// 仅在用户改变搜索关键字时强制滚动到底部，避免覆盖 autoScroll
watch(searchQuery, () => {
  scrollToBottom(true)
})

onMounted(() => {
  scrollToBottom(true)
})

// 复制日志
const copyLogs = async () => {
  try {
    await navigator.clipboard.writeText(props.logs.join('\n'))
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 2000)
  } catch (err) {
    // ignore
  }
}

// 清除本地显示
const clearLocalLogs = () => {
  props.logs.splice(0, props.logs.length)
}
</script>

<template>
  <div class="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[380px] shadow-lg select-text">
    <!-- 终端顶部控制栏 -->
    <div class="h-11 bg-secondary/60 border-b border-border px-4 flex items-center justify-between select-none shrink-0">
      <div class="flex items-center gap-2">
        <Terminal class="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
        <span class="text-xs font-bold text-foreground font-mono tracking-wider">GATEWAY_DAEMON_TERM</span>
      </div>

      <!-- 右侧控制按钮组 -->
      <div class="flex items-center gap-3">
        <!-- 搜索输入框 -->
        <div class="relative flex items-center">
          <Search class="w-3 h-3 absolute left-2.5 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('logs.searchPlaceholder')"
            class="bg-background/80 border border-border rounded-md pl-7 pr-7 py-1 text-[11px] font-mono text-foreground w-36 focus:w-48 focus:border-primary/30 focus:outline-none transition-all duration-300"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="absolute right-1.5 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            :aria-label="t('common.clearSearch')"
            :title="t('common.clearSearch')"
            @click="searchQuery = ''"
          >
            <X class="h-3 w-3" />
          </button>
        </div>

        <!-- 自动滚动开关 -->
        <button
          @click="autoScroll = !autoScroll"
          :class="[
            'p-1.5 rounded border transition-colors cursor-pointer',
            autoScroll
              ? 'bg-primary/10 text-primary border-primary/15'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary'
          ]"
          :title="t('logs.autoScroll')"
        >
          <ArrowDown class="w-3.5 h-3.5" />
        </button>

        <!-- 一键复制 -->
        <button
          @click="copyLogs"
          class="p-1.5 rounded text-muted-foreground border border-transparent hover:text-foreground hover:bg-secondary cursor-pointer"
                    :title="copySuccess ? t('logs.copied') : t('logs.copyAll')"
        >
          <Copy class="w-3.5 h-3.5" :class="copySuccess ? 'text-emerald-700 dark:text-emerald-400' : ''" />
        </button>

        <!-- 清空日志 -->
        <button
          @click="clearLocalLogs"
          class="p-1.5 rounded text-muted-foreground border border-transparent hover:text-rose-700 dark:hover:text-rose-400 hover:bg-secondary cursor-pointer"
          :title="t('logs.clear')"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- 终端命令行区 -->
    <div
      ref="terminalBody"
      class="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed space-y-1 bg-background/80 scroll-smooth"
    >
      <div v-if="parsedLogs.length === 0" class="text-muted text-center py-10 italic">
        {{ searchQuery ? t('logs.noSearchResults') : t('logs.empty') }}
      </div>
      <div v-else v-for="item in parsedLogs" :key="item.id" class="whitespace-pre-wrap break-all flex items-start gap-2 hover:bg-secondary/50 px-1 rounded">
        <!-- 1. 时间戳 (柔和灰色) -->
        <span v-if="item.parsed.time" class="text-muted select-none shrink-0">{{ item.parsed.time.split(' ')[1] }}</span>

        <!-- 2. 组件-操作 标签高亮 -->
        <span v-if="item.parsed.component" :class="[
          'px-1.5 py-0.2 rounded text-[10px] uppercase font-bold shrink-0 tracking-wider',
          item.parsed.type === 'error' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/15' :
          item.parsed.type === 'warn' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15' :
          item.parsed.component === 'Scheduler' ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/15' :
          item.parsed.component === 'Config' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/15' :
          item.parsed.component === 'Updater' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/15' :
          'bg-secondary text-foreground border border-border'
        ]">
          {{ item.parsed.component }}<span v-if="item.parsed.action" class="opacity-60 text-[9px]">.{{ item.parsed.action }}</span>
        </span>

        <!-- 3. 日志正文内容根据状态渲染不同颜色 -->
        <span :class="[
          'flex-1 font-sans text-foreground text-[12px]',
          item.parsed.type === 'error' ? 'text-rose-700 dark:text-rose-400 font-medium' :
          item.parsed.type === 'warn' ? 'text-amber-700 dark:text-amber-300 font-medium' :
          item.parsed.type === 'success' ? 'text-emerald-700 dark:text-emerald-400 font-medium' : ''
        ]">
          {{ item.parsed.msg }}
        </span>
      </div>

      <!-- 闪烁的终端命令输入提示符，突显高科技质感 -->
      <div class="flex items-center gap-1.5 pt-1.5 text-primary/75 select-none" v-if="status.running && !searchQuery">
        <span>$</span>
        <span class="w-1.5 h-3.5 bg-blue-500/80 animate-pulse inline-block"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}
.animate-pulse {
  animation: pulse 1s infinite steps(2, start);
}
</style>
