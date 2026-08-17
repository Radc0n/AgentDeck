import { useEffect } from 'react'
import { unlockAttentionSound } from '../attentionSound'
import { useWorkspaceStore } from '../store/workspace'

/** Tüm terminallerin ATTENTION_CHANGED olaylarını store'a yansıtır (arka plan projeleri dahil). */
export function useAttentionSync(): void {
  const setAttention = useWorkspaceStore((state) => state.setAttention)

  useEffect(() => {
    const unlock = (): void => {
      unlockAttentionSound()
    }

    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    return window.agentdeck.onAttentionChanged((event) => {
      setAttention(event.terminalId, event.state)
    })
  }, [setAttention])
}
