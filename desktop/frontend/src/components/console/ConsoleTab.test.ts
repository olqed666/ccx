import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConsoleTab from './ConsoleTab.vue'

const status = ref({ running: true })
const activeTab = ref('messages')
const refreshError = ref('')

vi.mock('@/composables/useStatus', () => ({
  useStatus: () => ({ status }),
}))

vi.mock('@/composables/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useConsoleChannels', () => ({
  useConsoleChannels: () => ({ activeTab, refreshError }),
}))

vi.mock('@bindings/github.com/BenedictKing/ccx/desktop/desktopservice', () => ({
  OpenWebUIInBrowser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/components/console/ChannelManager.vue', () => ({
  default: defineComponent({
    props: { type: { type: String, required: true } },
    setup(props) {
      return () => h('button', { type: 'button', 'data-testid': 'channel-manager' }, `channel:${props.type}`)
    },
  }),
}))

vi.mock('@/components/console/ConversationDashboard.vue', () => ({
  default: defineComponent({
    setup() {
      return () => h('button', { type: 'button', 'data-testid': 'conversation-dashboard' }, 'conversations')
    },
  }),
}))

describe('ConsoleTab', () => {
  let root: HTMLDivElement
  let errors: unknown[]

  beforeEach(() => {
    status.value = { running: true }
    activeTab.value = 'messages'
    refreshError.value = ''
    root = document.createElement('div')
    document.body.append(root)
    errors = []
    window.addEventListener('unhandledrejection', captureUnhandledRejection)
  })

  afterEach(() => {
    window.removeEventListener('unhandledrejection', captureUnhandledRejection)
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  function captureUnhandledRejection(event: PromiseRejectionEvent) {
    errors.push(event.reason)
  }

  it('switches dashboard panels without keeping the inactive panel mounted', async () => {
    const updates: string[] = []
    const app = createApp(ConsoleTab, {
      selection: '/channels/messages',
      'onUpdate:selection': (selection: string) => updates.push(selection),
    })
    const vueErrors: unknown[] = []
    app.config.errorHandler = error => vueErrors.push(error)

    app.mount(root)
    await nextTick()

    expect(root.querySelector('[data-testid="channel-manager"]')?.textContent).toBe('channel:messages')
    expect(root.querySelector('[data-testid="conversation-dashboard"]')).toBeNull()

    const conversationsButton = findButton('app.tabs.conversations')
    conversationsButton.click()
    await nextTick()

    expect(updates).toContain('/conversations')
    expect(root.querySelector('[data-testid="conversation-dashboard"]')?.textContent).toBe('conversations')
    expect(root.querySelector('[data-testid="channel-manager"]')).toBeNull()

    const channelsButton = findButton('app.tabs.messages')
    channelsButton.click()
    await nextTick()

    expect(updates.at(-1)).toBe('/channels/messages')
    expect(root.querySelector('[data-testid="channel-manager"]')?.textContent).toBe('channel:messages')
    expect(root.querySelector('[data-testid="conversation-dashboard"]')).toBeNull()

    const chatButton = findButton('OpenAI Chat')
    chatButton.click()
    await nextTick()

    expect(activeTab.value).toBe('chat')
    expect(updates.at(-1)).toBe('/channels/chat')
    expect(root.querySelector('[data-testid="channel-manager"]')?.textContent).toBe('channel:chat')
    expect(vueErrors).toEqual([])
    expect(errors).toEqual([])

    app.unmount()
  })

  function findButton(text: string): HTMLButtonElement {
    const button = [...root.querySelectorAll('button')]
      .find(item => item.textContent?.trim() === text)
    expect(button).toBeTruthy()
    return button as HTMLButtonElement
  }
})
