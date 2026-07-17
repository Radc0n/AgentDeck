import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from './workspace'
import type { Project } from '../global'

const saveWorkspaceMock = vi.fn()

function makeProject(id: string): Project {
  return {
    id,
    name: id,
    path: `C:\\${id}`,
    terminals: [],
    savedCommands: [],
    pinned: false,
    notebooks: []
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  saveWorkspaceMock.mockClear()
  ;(globalThis as unknown as { window: unknown }).window = {
    agentdeck: { saveWorkspace: saveWorkspaceMock }
  }
  useWorkspaceStore.setState({
    projects: [makeProject('p1'), makeProject('p2')],
    activeProjectId: 'p1',
    attentionByTerminalId: {},
    globalNotebooks: [],
    isNotesPanelOpen: false
  })
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('workspace store Diğer rafı', () => {
  it('setProjectOther projeyi Diğer rafına taşır ve pin kaldırır', () => {
    useWorkspaceStore.setState({
      projects: [
        { ...makeProject('p1'), pinned: true },
        makeProject('p2')
      ],
      activeProjectId: 'p1'
    })

    useWorkspaceStore.getState().setProjectOther('p1', true)

    const projects = useWorkspaceStore.getState().projects
    const p1 = projects.find((p) => p.id === 'p1')
    expect(p1?.other).toBe(true)
    expect(p1?.pinned).toBe(false)
    expect(projects.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('setProjectOther false ile ana çubuğa geri alır', () => {
    useWorkspaceStore.setState({
      projects: [
        makeProject('p2'),
        { ...makeProject('p1'), other: true }
      ],
      activeProjectId: 'p1'
    })

    useWorkspaceStore.getState().setProjectOther('p1', false)

    const p1 = useWorkspaceStore.getState().projects.find((p) => p.id === 'p1')
    expect(p1?.other).toBe(false)
  })

  it('reorderMainProjects yalnızca ana çubuğu sıralar', () => {
    useWorkspaceStore.setState({
      projects: [
        makeProject('a'),
        makeProject('b'),
        { ...makeProject('o'), other: true }
      ],
      activeProjectId: 'a'
    })

    useWorkspaceStore.getState().reorderMainProjects(0, 2)

    expect(useWorkspaceStore.getState().projects.map((p) => p.id)).toEqual([
      'b',
      'a',
      'o'
    ])
  })
})

describe('workspace store defterleri', () => {
  it('createGlobalNotebook ekler ve persist tetikler', () => {
    const id = useWorkspaceStore.getState().createGlobalNotebook('Genel defter')

    const notebooks = useWorkspaceStore.getState().globalNotebooks
    expect(notebooks).toHaveLength(1)
    expect(notebooks[0].id).toBe(id)
    expect(notebooks[0].name).toBe('Genel defter')
    expect(notebooks[0].content).toBe('')

    vi.runAllTimers()
    expect(saveWorkspaceMock).toHaveBeenCalledTimes(1)
    expect(saveWorkspaceMock.mock.calls[0][0].globalNotebooks).toHaveLength(1)
  })

  it('setProjectNotebookContent doğru defteri günceller', () => {
    const id = useWorkspaceStore.getState().createProjectNotebook('p1', 'Sprint')
    useWorkspaceStore.getState().setProjectNotebookContent('p1', id, 'yapılacaklar')

    const p1 = useWorkspaceStore.getState().projects.find((p) => p.id === 'p1')
    const p2 = useWorkspaceStore.getState().projects.find((p) => p.id === 'p2')
    expect(p1?.notebooks?.[0].content).toBe('yapılacaklar')
    expect(p2?.notebooks).toEqual([])

    vi.runAllTimers()
    expect(saveWorkspaceMock).toHaveBeenCalled()
  })

  it('deleteGlobalNotebook defteri siler ve order reindex eder', () => {
    const a = useWorkspaceStore.getState().createGlobalNotebook('A')
    const b = useWorkspaceStore.getState().createGlobalNotebook('B')
    useWorkspaceStore.getState().deleteGlobalNotebook(a)

    const notebooks = useWorkspaceStore.getState().globalNotebooks
    expect(notebooks).toHaveLength(1)
    expect(notebooks[0].id).toBe(b)
    expect(notebooks[0].order).toBe(0)
  })

  it('toggleNotesPanel durumu ters çevirir ve persist tetikler', () => {
    useWorkspaceStore.getState().toggleNotesPanel()

    expect(useWorkspaceStore.getState().isNotesPanelOpen).toBe(true)

    vi.runAllTimers()
    expect(saveWorkspaceMock).toHaveBeenCalledTimes(1)
    expect(saveWorkspaceMock.mock.calls[0][0].notesPanelOpen).toBe(true)
  })
})
