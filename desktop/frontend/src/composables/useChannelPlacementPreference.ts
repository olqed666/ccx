import { ref } from 'vue'

export type NewChannelPlacement = 'top' | 'bottom'

const STORAGE_KEY = 'ccx-desktop-new-channel-placement'
const DEFAULT_PLACEMENT: NewChannelPlacement = 'top'

function loadPlacement(): NewChannelPlacement {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'bottom' ? 'bottom' : DEFAULT_PLACEMENT
  } catch {
    return DEFAULT_PLACEMENT
  }
}

function persistPlacement(value: NewChannelPlacement) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // localStorage 不可用时仅保留当前进程内状态
  }
}

const placement = ref<NewChannelPlacement>(loadPlacement())

export function useChannelPlacementPreference() {
  const setPlacement = (value: NewChannelPlacement) => {
    placement.value = value
    persistPlacement(value)
  }

  return {
    newChannelPlacement: placement,
    setNewChannelPlacement: setPlacement,
  }
}
