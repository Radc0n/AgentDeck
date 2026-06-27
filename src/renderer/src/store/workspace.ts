import { create } from 'zustand'
import type { AttentionState, Project, Terminal, Workspace } from '../global'
import { clampProjectInsertionSlot, sortProjectsPinnedFirst } from '../projectOrder'

const CURRENT_SCHEMA_VERSION = 1
const SAVE_DEBOUNCE_MS = 400

let saveTimer: ReturnType<typeof setTimeout> | null = null

function buildWorkspace(
  projects: Project[],
  activeProjectId: string,
  globalNotes: string,
  notesPanelOpen: boolean
): Workspace {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects,
    activeProjectId,
    globalNotes,
    notesPanelOpen
  }
}

function schedulePersist(
  projects: Project[],
  activeProjectId: string,
  globalNotes: string,
  notesPanelOpen: boolean
): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    saveTimer = null
    const workspace = buildWorkspace(projects, activeProjectId, globalNotes, notesPanelOpen)
    void window.agentdeck.saveWorkspace(workspace)
  }, SAVE_DEBOUNCE_MS)
}

function terminalIdsForProject(project: Project): string[] {
  return project.terminals.map((terminal) => terminal.id)
}

function stripAttentionForTerminals(
  attentionByTerminalId: Record<string, AttentionState>,
  terminalIds: string[]
): Record<string, AttentionState> {
  if (terminalIds.length === 0) {
    return attentionByTerminalId
  }

  const next = { ...attentionByTerminalId }
  for (const terminalId of terminalIds) {
    delete next[terminalId]
  }
  return next
}

export interface WorkspaceStoreState {
  projects: Project[]
  activeProjectId: string
  attentionByTerminalId: Record<string, AttentionState>
  globalNotes: string
  isNotesPanelOpen: boolean
  hydrate: (workspace: Workspace) => void
  addProject: (project: Project) => void
  removeProject: (projectId: string) => void
  togglePinProject: (projectId: string) => void
  setActiveProject: (projectId: string) => void
  reorderProjects: (fromIndex: number, toIndex: number) => void
  addTerminal: (projectId: string, terminal: Terminal) => void
  removeTerminal: (projectId: string, terminalId: string) => void
  setAttention: (terminalId: string, state: AttentionState) => void
  setGlobalNotes: (notes: string) => void
  setProjectNotes: (projectId: string, notes: string) => void
  toggleNotesPanel: () => void
  getActiveProject: () => Project | undefined
  getAttention: (terminalId: string) => AttentionState
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  projects: [],
  activeProjectId: '',
  attentionByTerminalId: {},
  globalNotes: '',
  isNotesPanelOpen: false,

  hydrate: (workspace) => {
    set({
      projects: sortProjectsPinnedFirst(
        workspace.projects.map((project) => ({
          ...project,
          terminals: []
        }))
      ),
      activeProjectId: workspace.activeProjectId,
      attentionByTerminalId: {},
      globalNotes: workspace.globalNotes ?? '',
      isNotesPanelOpen: workspace.notesPanelOpen ?? false
    })
  },

  addProject: (project) => {
    set((state) => {
      const projects = [...state.projects, project]
      const activeProjectId =
        state.activeProjectId === '' ? project.id : state.activeProjectId
      schedulePersist(projects, activeProjectId, state.globalNotes, state.isNotesPanelOpen)
      return { projects, activeProjectId }
    })
  },

  removeProject: (projectId) => {
    set((state) => {
      const removed = state.projects.find((project) => project.id === projectId)
      const projects = state.projects.filter((project) => project.id !== projectId)
      let activeProjectId = state.activeProjectId

      if (activeProjectId === projectId) {
        activeProjectId = projects[0]?.id ?? ''
      }

      const attentionByTerminalId = removed
        ? stripAttentionForTerminals(
            state.attentionByTerminalId,
            terminalIdsForProject(removed)
          )
        : state.attentionByTerminalId

      schedulePersist(projects, activeProjectId, state.globalNotes, state.isNotesPanelOpen)
      return { projects, activeProjectId, attentionByTerminalId }
    })
  },

  togglePinProject: (projectId) => {
    set((state) => {
      const index = state.projects.findIndex((project) => project.id === projectId)
      if (index === -1) {
        return state
      }

      const current = state.projects[index]
      const toggled: Project = { ...current, pinned: !current.pinned }
      const projects = state.projects.filter((project) => project.id !== projectId)

      if (toggled.pinned) {
        const firstUnpinnedIndex = projects.findIndex((project) => !project.pinned)
        if (firstUnpinnedIndex === -1) {
          projects.push(toggled)
        } else {
          projects.splice(firstUnpinnedIndex, 0, toggled)
        }
      } else {
        projects.push(toggled)
      }

      schedulePersist(projects, state.activeProjectId, state.globalNotes, state.isNotesPanelOpen)
      return { projects }
    })
  },

  setActiveProject: (projectId) => {
    set((state) => {
      if (state.activeProjectId === projectId) {
        return state
      }

      const project = state.projects.find((item) => item.id === projectId)
      if (project) {
        void window.agentdeck.dismissAttentionForTerminals({
          terminalIds: project.terminals.map((terminal) => terminal.id)
        })
      }

      schedulePersist(state.projects, projectId, state.globalNotes, state.isNotesPanelOpen)
      return { activeProjectId: projectId }
    })
  },

  reorderProjects: (fromIndex, toSlot) => {
    set((state) => {
      const { length } = state.projects
      if (
        fromIndex < 0 ||
        fromIndex >= length ||
        toSlot < 0 ||
        toSlot > length
      ) {
        return state
      }

      const moved = state.projects[fromIndex]
      const clampedSlot = clampProjectInsertionSlot(state.projects, moved.id, toSlot)

      let insertAt = clampedSlot
      if (fromIndex < clampedSlot) {
        insertAt = clampedSlot - 1
      }

      if (fromIndex === insertAt) {
        return state
      }

      const projects = [...state.projects]
      projects.splice(fromIndex, 1)
      projects.splice(insertAt, 0, moved)

      schedulePersist(projects, state.activeProjectId, state.globalNotes, state.isNotesPanelOpen)
      return { projects }
    })
  },

  addTerminal: (projectId, terminal) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }

        return {
          ...project,
          terminals: [...project.terminals, terminal]
        }
      })

      schedulePersist(projects, state.activeProjectId, state.globalNotes, state.isNotesPanelOpen)
      return { projects }
    })
  },

  removeTerminal: (projectId, terminalId) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }

        return {
          ...project,
          terminals: project.terminals.filter((terminal) => terminal.id !== terminalId)
        }
      })

      const attentionByTerminalId = stripAttentionForTerminals(state.attentionByTerminalId, [
        terminalId
      ])

      schedulePersist(projects, state.activeProjectId, state.globalNotes, state.isNotesPanelOpen)
      return { projects, attentionByTerminalId }
    })
  },

  setAttention: (terminalId, attentionState) => {
    set((state) => {
      if (state.attentionByTerminalId[terminalId] === attentionState) {
        return state
      }

      return {
        attentionByTerminalId: {
          ...state.attentionByTerminalId,
          [terminalId]: attentionState
        }
      }
    })
  },

  setGlobalNotes: (notes) => {
    set({ globalNotes: notes })
    const { projects, activeProjectId, isNotesPanelOpen } = get()
    schedulePersist(projects, activeProjectId, notes, isNotesPanelOpen)
  },

  setProjectNotes: (projectId, notes) => {
    set((state) => {
      const projects = state.projects.map((project) =>
        project.id === projectId ? { ...project, notes } : project
      )

      schedulePersist(projects, state.activeProjectId, state.globalNotes, state.isNotesPanelOpen)
      return { projects }
    })
  },

  toggleNotesPanel: () => {
    set((state) => {
      const isNotesPanelOpen = !state.isNotesPanelOpen
      schedulePersist(state.projects, state.activeProjectId, state.globalNotes, isNotesPanelOpen)
      return { isNotesPanelOpen }
    })
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find((project) => project.id === activeProjectId)
  },

  getAttention: (terminalId) => {
    return get().attentionByTerminalId[terminalId] ?? 'idle'
  }
}))
