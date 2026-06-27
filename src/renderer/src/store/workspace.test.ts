import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from './workspace'
import type { Project } from '../global'

const saveWorkspaceMock = vi.fn()

function makeProject(id: string, notes?: string): Project {
  return {
    id,
    name: id,
    path: `C:\\${id}`,
    terminals: [],
    savedCommands: [],
    pinned: false,
    notes
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  saveWorkspaceMock.mockClear()
  // Store'un persist çağrısı için window.agentdeck'i stub'la.
  ;(globalThis as unknown as { window: unknown }).window = {
    agentdeck: { saveWorkspace: saveWorkspaceMock }
  }
  useWorkspaceStore.setState({
    projects: [makeProject('p1', 'eski not'), makeProject('p2')],
    activeProjectId: 'p1',
    attentionByTerminalId: {},
    globalNotes: '',
    isNotesPanelOpen: false
  })
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('workspace store notları', () => {
  it('setGlobalNotes global notu immutable günceller ve persist tetikler', () => {
    useWorkspaceStore.getState().setGlobalNotes('yeni genel not')

    expect(useWorkspaceStore.getState().globalNotes).toBe('yeni genel not')

    vi.runAllTimers()
    expect(saveWorkspaceMock).toHaveBeenCalledTimes(1)
    expect(saveWorkspaceMock.mock.calls[0][0].globalNotes).toBe('yeni genel not')
  })

  it('setProjectNotes doğru projeyi günceller, diğerini etkilemez', () => {
    useWorkspaceStore.getState().setProjectNotes('p1', 'güncel not')

    const projects = useWorkspaceStore.getState().projects
    expect(projects.find((p) => p.id === 'p1')?.notes).toBe('güncel not')
    expect(projects.find((p) => p.id === 'p2')?.notes).toBeUndefined()

    vi.runAllTimers()
    expect(saveWorkspaceMock).toHaveBeenCalledTimes(1)
  })

  it('toggleNotesPanel durumu ters çevirir ve persist tetikler', () => {
    useWorkspaceStore.getState().toggleNotesPanel()

    expect(useWorkspaceStore.getState().isNotesPanelOpen).toBe(true)

    vi.runAllTimers()
    expect(saveWorkspaceMock).toHaveBeenCalledTimes(1)
    expect(saveWorkspaceMock.mock.calls[0][0].notesPanelOpen).toBe(true)
  })
})
