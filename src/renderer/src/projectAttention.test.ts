import { describe, expect, it } from 'vitest'
import type { AttentionState, Project } from './global'
import { projectHasUnreadAttention } from './projectAttention'

function project(id: string, terminalIds: string[]): Project {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    terminals: terminalIds.map((terminalId, order) => ({
      id: terminalId,
      name: terminalId,
      profile: 'shell' as const,
      cwd: `/tmp/${id}`,
      order
    })),
    savedCommands: []
  }
}

describe('projectHasUnreadAttention', () => {
  it('aktif olmayan projede needsAttention terminali varsa true döner', () => {
    const finansbot = project('finansbot', ['t1'])
    const attention: Record<string, AttentionState> = { t1: 'needsAttention' }

    expect(projectHasUnreadAttention(finansbot, attention, 'agentdeck')).toBe(true)
  })

  it('aktif projede rozet göstermez', () => {
    const agentdeck = project('agentdeck', ['t1'])
    const attention: Record<string, AttentionState> = { t1: 'needsAttention' }

    expect(projectHasUnreadAttention(agentdeck, attention, 'agentdeck')).toBe(false)
  })

  it('tüm terminaller idle ise false döner', () => {
    const finansbot = project('finansbot', ['t1'])
    const attention: Record<string, AttentionState> = { t1: 'idle' }

    expect(projectHasUnreadAttention(finansbot, attention, 'agentdeck')).toBe(false)
  })

  it('busy durumu rozet tetiklemez', () => {
    const finansbot = project('finansbot', ['t1'])
    const attention: Record<string, AttentionState> = { t1: 'busy' }

    expect(projectHasUnreadAttention(finansbot, attention, 'agentdeck')).toBe(false)
  })
})
