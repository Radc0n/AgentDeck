import { useEffect } from 'react'
import { playAttentionSound } from '../attentionSound'
import { useWorkspaceStore } from '../store/workspace'

/** Tüm terminallerin ATTENTION_CHANGED olaylarını store'a yansıtır (arka plan projeleri dahil). */
export function useAttentionSync(): void {
  const setAttention = useWorkspaceStore((state) => state.setAttention)

  useEffect(() => {
    return window.agentdeck.onAttentionChanged((event) => {
      const previous =
        useWorkspaceStore.getState().attentionByTerminalId[event.terminalId] ?? 'idle'

      setAttention(event.terminalId, event.state)

      if (event.state === 'needsAttention' && previous !== 'needsAttention') {
        playAttentionSound()
      }
    })
  }, [setAttention])
}
