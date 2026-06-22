import { create } from 'zustand'
import type { AttentionState, Project, Terminal, Workspace } from '../global'
import { clampProjectInsertionSlot, sortProjectsPinnedFirst } from '../projectOrder'

const CURRENT_SCHEMA_VERSION = 1
const SAVE_DEBOUNCE_MS = 400

let saveTimer: ReturnType<typeof setTimeout> | null = null

function buildWorkspace(projects: Project[], activeProjectId: string): Workspace {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects,
    activeProjectId
  }
}

function schedulePersist(projects: Project[], activeProjectId: string): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    saveTimer = null
    const workspace = buildWorkspace(projects, activeProjectId)
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
  hydrate: (workspace: Workspace) => void
  addProject: (project: Project) => void
  removeProject: (projectId: string) => void
  togglePinProject: (projectId: string) => void
  setActiveProject: (projectId: string) => void
  reorderProjects: (fromIndex: number, toIndex: number) => void
  addTerminal: (projectId: string, terminal: Terminal) => void
  removeTerminal: (projectId: string, terminalId: string) => void
  setAttention: (terminalId: string, state: AttentionState) => void
  getActiveProject: () => Project | undefined
  getAttention: (terminalId: string) => AttentionState
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  projects: [],
  activeProjectId: '',
  attentionByTerminalId: {},

  hydrate: (workspace) => {
    set({
      projects: sortProjectsPinnedFirst(workspace.projects),
      activeProjectId: workspace.activeProjectId,
      attentionByTerminalId: {}
    })
  },

  addProject: (project) => {
    set((state) => {
      const projects = [...state.projects, project]
      const activeProjectId =
        state.activeProjectId === '' ? project.id : state.activeProjectId
      schedulePersist(projects, activeProjectId)
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

      schedulePersist(projects, activeProjectId)
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

      schedulePersist(projects, state.activeProjectId)
      return { projects }
    })
  },

  setActiveProject: (projectId) => {
    set((state) => {
      if (state.activeProjectId === projectId) {
        return state
      }

      schedulePersist(state.projects, projectId)
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

      schedulePersist(projects, state.activeProjectId)
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

      schedulePersist(projects, state.activeProjectId)
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

      schedulePersist(projects, state.activeProjectId)
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

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find((project) => project.id === activeProjectId)
  },

  getAttention: (terminalId) => {
    return get().attentionByTerminalId[terminalId] ?? 'idle'
  }
}))
