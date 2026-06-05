import type { ChannelMetrics, ChannelStatus, ResumeChannelResponse, SchedulerStatsResponse } from '@/services/admin-api'
import { useAdminApi } from '@/composables/useAdminApi'

export type ManagedChannelType = 'messages' | 'chat' | 'responses' | 'gemini' | 'images'

export interface ChannelTypeApi {
  getMetrics: () => Promise<ChannelMetrics[]>
  getSchedulerStats: () => Promise<SchedulerStatsResponse>
  reorder: (order: number[]) => Promise<void>
  setStatus: (channelId: number, status: ChannelStatus) => Promise<void>
  resume: (channelId: number) => Promise<ResumeChannelResponse>
  promote: (channelId: number, durationSeconds: number) => Promise<void>
  getDashboard: () => Promise<any>
  getChannels: () => Promise<any>
  addChannel: (channel: any) => Promise<any>
  updateChannel: (channelId: number, channel: any) => Promise<any>
  deleteChannel: (channelId: number) => Promise<void>
  pingChannel: (channelId: number) => Promise<any>
  pingAll: () => Promise<any>
  addApiKey: (channelId: number, key: string) => Promise<any>
  removeApiKey: (channelId: number, key: string) => Promise<any>
  restoreApiKey: (channelId: number, key: string) => Promise<any>
  moveApiKeyToTop: (channelId: number, key: string) => Promise<any>
  moveApiKeyToBottom: (channelId: number, key: string) => Promise<any>
  getChannelLogs: (channelId: number) => Promise<any>
  getChannelModels: (channelId: number, body: any) => Promise<any>
  getMetricsHistory: (channelId?: number, duration?: string) => Promise<any>
  getKeyMetricsHistory: (channelId: number, duration?: string) => Promise<any>
  getGlobalStats: (duration?: string) => Promise<any>
  getModelStats: (duration?: string) => Promise<any>
}

/**
 * 根据频道类型返回对应的 API 调用方法。
 * 所有方法直接通过 HTTP 调用本地后端 /api/* 端点。
 */
export function getChannelTypeApi(channelType: ManagedChannelType): ChannelTypeApi {
  const api = useAdminApi()
  const prefix = `/api/${channelType}`

  return {
    getMetrics: () => api.get(`${prefix}/channels/metrics`),
    getSchedulerStats: () => api.get(`/api/messages/channels/scheduler/stats?type=${channelType}`),
    reorder: (order) => api.post(`${prefix}/channels/reorder`, { order }),
    setStatus: (channelId, status) => api.patch(`${prefix}/channels/${channelId}/status`, { status }),
    resume: (channelId) => api.post(`${prefix}/channels/${channelId}/resume`),
    promote: (channelId, durationSeconds) => api.post(`${prefix}/channels/${channelId}/promotion`, { duration: durationSeconds }),
    getDashboard: () => api.get(`/api/messages/channels/dashboard?type=${channelType}`),
    getChannels: () => api.get(`${prefix}/channels`),
    addChannel: (channel) => api.post(`${prefix}/channels`, channel),
    updateChannel: (channelId, channel) => api.put(`${prefix}/channels/${channelId}`, channel),
    deleteChannel: (channelId) => api.del(`${prefix}/channels/${channelId}`),
    pingChannel: (channelId) => api.post(`${prefix}/ping/${channelId}`),
    pingAll: () => api.post(`${prefix}/ping`),
    addApiKey: (channelId, key) => api.post(`${prefix}/channels/${channelId}/keys`, { key }),
    removeApiKey: (channelId, key) => api.del(`${prefix}/channels/${channelId}/keys/${encodeURIComponent(key)}`),
    restoreApiKey: (channelId, key) => api.post(`${prefix}/channels/${channelId}/keys/restore`, { apiKey: key }),
    moveApiKeyToTop: (channelId, key) => api.post(`${prefix}/channels/${channelId}/keys/${encodeURIComponent(key)}/top`),
    moveApiKeyToBottom: (channelId, key) => api.post(`${prefix}/channels/${channelId}/keys/${encodeURIComponent(key)}/bottom`),
    getChannelLogs: (channelId) => api.get(`${prefix}/channels/${channelId}/logs`),
    getChannelModels: (channelId, body) => api.post(`${prefix}/channels/${channelId}/models`, body),
    getMetricsHistory: (channelId, duration = '1h') => {
      if (channelId !== undefined) {
        return api.get(`${prefix}/channels/metrics/history?duration=${duration}`)
      }
      return api.get(`${prefix}/channels/metrics/history?duration=${duration}`)
    },
    getKeyMetricsHistory: (channelId, duration = '1h') => api.get(`${prefix}/channels/${channelId}/keys/metrics/history?duration=${duration}`),
    getGlobalStats: (duration = '1h') => api.get(`${prefix}/global/stats/history?duration=${duration}`),
    getModelStats: (duration = '1h') => api.get(`${prefix}/models/stats/history?duration=${duration}`),
  }
}
