import type { ConversationInfo } from '@/services/admin-api'

export type BoardColumnKey = 'working' | 'idle'

export interface SubagentSummary {
  total: number
  streaming: number
  active: number
  idle: number
}

export interface ConversationBoardItem {
  conversation: ConversationInfo
  subagents: ConversationInfo[]
  aggregateStatus: BoardColumnKey
  subagentSummary: SubagentSummary
}

export function buildConversationBoardItems(items: ConversationInfo[]): ConversationBoardItem[] {
  const byID = new Map(items.map(item => [item.id, item]))
  const childrenByParent = new Map<string, ConversationInfo[]>()
  const referencedChildIDs = new Set<string>()

  for (const item of items) {
    for (const childID of item.childConversationIds ?? []) {
      const child = byID.get(childID)
      if (!child || child.id === item.id) continue
      referencedChildIDs.add(child.id)
      appendChild(childrenByParent, item.id, child)
    }
  }

  for (const item of items) {
    const parentID = item.parentConversationId
    if (!parentID || !byID.has(parentID)) continue
    appendChild(childrenByParent, parentID, item)
  }

  return items
    .filter(item => !hasExistingParent(item, byID, referencedChildIDs))
    .map(conversation => {
      const subagents = collectSubagents(conversation, childrenByParent)
      return {
        conversation,
        subagents,
        subagentSummary: summarizeSubagents(subagents),
        aggregateStatus: getConversationBoardColumnKey(conversation, subagents),
      }
    })
}

function appendChild(childrenByParent: Map<string, ConversationInfo[]>, parentID: string, child: ConversationInfo) {
  const children = childrenByParent.get(parentID) ?? []
  if (!children.some(item => item.id === child.id)) children.push(child)
  childrenByParent.set(parentID, children)
}

function hasExistingParent(item: ConversationInfo, byID: Map<string, ConversationInfo>, referencedChildIDs: Set<string>): boolean {
  if (item.parentConversationId && byID.has(item.parentConversationId)) return true
  return referencedChildIDs.has(item.id)
}

export function buildConversationColumnBuckets(items: ConversationInfo[]): Record<BoardColumnKey, ConversationBoardItem[]> {
  const buckets: Record<BoardColumnKey, ConversationBoardItem[]> = {
    working: [],
    idle: [],
  }

  for (const item of buildConversationBoardItems(items)) {
    buckets[item.aggregateStatus].push(item)
  }

  return buckets
}

export function filterConversationBoardItems(items: ConversationBoardItem[], kindFilter: string, searchQuery: string): ConversationBoardItem[] {
  const kind = kindFilter.trim()
  const query = searchQuery.trim().toLowerCase()

  return items.filter(item => {
    const related = [item.conversation, ...item.subagents]
    if (kind && !related.some(conversation => conversation.kind === kind)) return false
    if (!query) return true
    return related.some(matchesConversationSearch(query))
  })
}

export function getConversationBoardColumnKey(conversation: ConversationInfo, subagents: ConversationInfo[] = []): BoardColumnKey {
  if (conversation.status !== 'idle') return 'working'
  if (subagents.some(item => item.status !== 'idle')) return 'working'
  return 'idle'
}

function collectSubagents(root: ConversationInfo, childrenByParent: Map<string, ConversationInfo[]>): ConversationInfo[] {
  const result: ConversationInfo[] = []
  const pending = [...(childrenByParent.get(root.id) ?? [])]
  const seen = new Set<string>()

  while (pending.length > 0) {
    const child = pending.shift()
    if (!child || seen.has(child.id)) continue
    seen.add(child.id)
    result.push(child)
    pending.push(...(childrenByParent.get(child.id) ?? []))
  }

  return result.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
}

function summarizeSubagents(subagents: ConversationInfo[]): SubagentSummary {
  return subagents.reduce<SubagentSummary>((summary, item) => {
    summary.total += 1
    if (item.status === 'streaming') summary.streaming += 1
    else if (item.status === 'idle') summary.idle += 1
    else summary.active += 1
    return summary
  }, { total: 0, streaming: 0, active: 0, idle: 0 })
}

function matchesConversationSearch(query: string): (conversation: ConversationInfo) => boolean {
  return conversation =>
    (conversation.title || '').toLowerCase().includes(query) ||
    (conversation.userId || '').toLowerCase().includes(query) ||
    (conversation.rawUserId || '').toLowerCase().includes(query) ||
    (conversation.lastModel || '').toLowerCase().includes(query) ||
    (conversation.channelName || '').toLowerCase().includes(query)
}
