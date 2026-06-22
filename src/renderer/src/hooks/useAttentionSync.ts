import { useEffect } from 'react'
import { useWorkspaceStore } from '../store/workspace'

/** Tüm terminallerin ATTENTION_CHANGED olaylarını store'a yansıtır (arka plan projeleri dahil). */
export function useAttentionSync(): void {
  const setAttention = useWorkspaceStore((state) => state.setAttention)

  useEffect(() => {
    return window.agentdeck.onAttentionChanged((event) => {
      setAttention(event.terminalId, event.state)
    })
  }, [setAttention])
}
