import { create } from 'zustand'
import type { AttentionState, Notebook, Project, Terminal, Workspace } from '../global'
import {
  clampProjectInsertionSlot,
  isMainProject,
  partitionProjects,
  sortAllProjects
} from '../projectOrder'

const CURRENT_SCHEMA_VERSION = 1
const SAVE_DEBOUNCE_MS = 400

let saveTimer: ReturnType<typeof setTimeout> | null = null

function buildWorkspace(
  projects: Project[],
  activeProjectId: string,
  globalNotebooks: Notebook[],
  notesPanelOpen: boolean
): Workspace {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects,
    activeProjectId,
    globalNotebooks,
    notesPanelOpen
  }
}

function schedulePersist(
  projects: Project[],
  activeProjectId: string,
  globalNotebooks: Notebook[],
  notesPanelOpen: boolean
): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    saveTimer = null
    const workspace = buildWorkspace(
      projects,
      activeProjectId,
      globalNotebooks,
      notesPanelOpen
    )
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

function reindexNotebooks(notebooks: Notebook[]): Notebook[] {
  return notebooks.map((notebook, order) =>
    notebook.order === order ? notebook : { ...notebook, order }
  )
}

function sortNotebooks(notebooks: Notebook[]): Notebook[] {
  return [...notebooks].sort((a, b) => a.order - b.order)
}

export interface WorkspaceStoreState {
  projects: Project[]
  activeProjectId: string
  /** Proje başına seçili (görünen) terminal sekmesi */
  activeTerminalByProjectId: Record<string, string>
  attentionByTerminalId: Record<string, AttentionState>
  globalNotebooks: Notebook[]
  isNotesPanelOpen: boolean
  hydrate: (workspace: Workspace) => void
  addProject: (project: Project) => void
  removeProject: (projectId: string) => void
  togglePinProject: (projectId: string) => void
  setProjectOther: (projectId: string, other: boolean) => void
  setActiveProject: (projectId: string) => void
  /** Ana çubuktaki (Diğer dışındaki) indekslerle yeniden sıralar */
  reorderMainProjects: (fromMainIndex: number, toMainSlot: number) => void
  addTerminal: (projectId: string, terminal: Terminal) => void
  removeTerminal: (projectId: string, terminalId: string) => void
  setActiveTerminal: (projectId: string, terminalId: string) => void
  setAttention: (terminalId: string, state: AttentionState) => void
  createGlobalNotebook: (name: string) => string
  createProjectNotebook: (projectId: string, name: string) => string
  renameGlobalNotebook: (notebookId: string, name: string) => void
  renameProjectNotebook: (projectId: string, notebookId: string, name: string) => void
  deleteGlobalNotebook: (notebookId: string) => void
  deleteProjectNotebook: (projectId: string, notebookId: string) => void
  setGlobalNotebookContent: (notebookId: string, content: string) => void
  setProjectNotebookContent: (
    projectId: string,
    notebookId: string,
    content: string
  ) => void
  toggleNotesPanel: () => void
  getActiveProject: () => Project | undefined
  getActiveTerminalId: (projectId?: string) => string | null
  getAttention: (terminalId: string) => AttentionState
}

function withoutProjectActiveTerminal(
  map: Record<string, string>,
  projectId: string
): Record<string, string> {
  if (!(projectId in map)) {
    return map
  }
  const next = { ...map }
  delete next[projectId]
  return next
}

function resolveActiveTerminalId(
  project: Project | undefined,
  preferredId: string | undefined
): string | null {
  if (!project || project.terminals.length === 0) {
    return null
  }
  if (preferredId && project.terminals.some((terminal) => terminal.id === preferredId)) {
    return preferredId
  }
  const sorted = [...project.terminals].sort((a, b) => a.order - b.order)
  return sorted[0]?.id ?? null
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  projects: [],
  activeProjectId: '',
  activeTerminalByProjectId: {},
  attentionByTerminalId: {},
  globalNotebooks: [],
  isNotesPanelOpen: false,

  hydrate: (workspace) => {
    set({
      projects: sortAllProjects(
        workspace.projects.map((project) => ({
          ...project,
          notebooks: sortNotebooks(project.notebooks ?? []),
          terminals: []
        }))
      ),
      activeProjectId: workspace.activeProjectId,
      activeTerminalByProjectId: {},
      attentionByTerminalId: {},
      globalNotebooks: sortNotebooks(workspace.globalNotebooks ?? []),
      isNotesPanelOpen: workspace.notesPanelOpen ?? false
    })
  },

  addProject: (project) => {
    set((state) => {
      const nextProject: Project = {
        ...project,
        notebooks: project.notebooks ?? [],
        other: project.other === true
      }
      const projects = sortAllProjects([...state.projects, nextProject])
      const activeProjectId =
        state.activeProjectId === '' ? project.id : state.activeProjectId
      schedulePersist(
        projects,
        activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
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

      schedulePersist(
        projects,
        activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return {
        projects,
        activeProjectId,
        attentionByTerminalId,
        activeTerminalByProjectId: withoutProjectActiveTerminal(
          state.activeTerminalByProjectId,
          projectId
        )
      }
    })
  },

  togglePinProject: (projectId) => {
    set((state) => {
      const index = state.projects.findIndex((project) => project.id === projectId)
      if (index === -1) {
        return state
      }

      const current = state.projects[index]
      // Diğer rafındayken sabitlemek ana çubuğa taşır
      const willPin = !current.pinned
      const toggled: Project = {
        ...current,
        pinned: willPin,
        other: willPin ? false : current.other
      }
      const without = state.projects.filter((project) => project.id !== projectId)
      const projects = sortAllProjects([...without, toggled])

      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return { projects }
    })
  },

  setProjectOther: (projectId, other) => {
    set((state) => {
      const index = state.projects.findIndex((project) => project.id === projectId)
      if (index === -1) {
        return state
      }

      const current = state.projects[index]
      if (current.other === other) {
        return state
      }

      const updated: Project = {
        ...current,
        other,
        // Diğer'e giderken pin kalkar
        pinned: other ? false : current.pinned
      }
      const without = state.projects.filter((project) => project.id !== projectId)
      const projects = sortAllProjects([...without, updated])

      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
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

      schedulePersist(
        state.projects,
        projectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return { activeProjectId: projectId }
    })
  },

  reorderMainProjects: (fromMainIndex, toMainSlot) => {
    set((state) => {
      const { main, other } = partitionProjects(state.projects)
      if (
        fromMainIndex < 0 ||
        fromMainIndex >= main.length ||
        toMainSlot < 0 ||
        toMainSlot > main.length
      ) {
        return state
      }

      const moved = main[fromMainIndex]
      if (!isMainProject(moved)) {
        return state
      }

      const clampedSlot = clampProjectInsertionSlot(main, moved.id, toMainSlot)

      let insertAt = clampedSlot
      if (fromMainIndex < clampedSlot) {
        insertAt = clampedSlot - 1
      }

      if (fromMainIndex === insertAt) {
        return state
      }

      const nextMain = [...main]
      nextMain.splice(fromMainIndex, 1)
      nextMain.splice(insertAt, 0, moved)

      const projects = [...nextMain, ...other]
      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
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

      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return {
        projects,
        activeTerminalByProjectId: {
          ...state.activeTerminalByProjectId,
          [projectId]: terminal.id
        }
      }
    })
  },

  removeTerminal: (projectId, terminalId) => {
    set((state) => {
      const project = state.projects.find((item) => item.id === projectId)
      const closedOrder =
        project?.terminals.find((terminal) => terminal.id === terminalId)?.order ?? 0
      const remaining = (project?.terminals ?? [])
        .filter((terminal) => terminal.id !== terminalId)
        .sort((a, b) => a.order - b.order)

      const projects = state.projects.map((item) => {
        if (item.id !== projectId) {
          return item
        }

        return {
          ...item,
          terminals: item.terminals.filter((terminal) => terminal.id !== terminalId)
        }
      })

      const attentionByTerminalId = stripAttentionForTerminals(state.attentionByTerminalId, [
        terminalId
      ])

      const currentActive = state.activeTerminalByProjectId[projectId]
      const activeStillValid =
        currentActive !== undefined &&
        currentActive !== terminalId &&
        remaining.some((terminal) => terminal.id === currentActive)

      let activeTerminalByProjectId = state.activeTerminalByProjectId
      if (!activeStillValid) {
        if (remaining.length === 0) {
          activeTerminalByProjectId = withoutProjectActiveTerminal(
            state.activeTerminalByProjectId,
            projectId
          )
        } else {
          const successor =
            remaining.find((terminal) => terminal.order >= closedOrder) ??
            remaining[remaining.length - 1]
          activeTerminalByProjectId = {
            ...state.activeTerminalByProjectId,
            [projectId]: successor.id
          }
        }
      }

      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return { projects, attentionByTerminalId, activeTerminalByProjectId }
    })
  },

  setActiveTerminal: (projectId, terminalId) => {
    set((state) => {
      const project = state.projects.find((item) => item.id === projectId)
      if (!project?.terminals.some((terminal) => terminal.id === terminalId)) {
        return state
      }
      if (state.activeTerminalByProjectId[projectId] === terminalId) {
        return state
      }
      return {
        activeTerminalByProjectId: {
          ...state.activeTerminalByProjectId,
          [projectId]: terminalId
        }
      }
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

  createGlobalNotebook: (name) => {
    const id = crypto.randomUUID()
    const trimmed = name.trim() || 'Yeni defter'
    set((state) => {
      const notebook: Notebook = {
        id,
        name: trimmed,
        content: '',
        order: state.globalNotebooks.length
      }
      const globalNotebooks = [...state.globalNotebooks, notebook]
      schedulePersist(
        state.projects,
        state.activeProjectId,
        globalNotebooks,
        state.isNotesPanelOpen
      )
      return { globalNotebooks }
    })
    return id
  },

  createProjectNotebook: (projectId, name) => {
    const id = crypto.randomUUID()
    const trimmed = name.trim() || 'Yeni defter'
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }
        const notebooks = project.notebooks ?? []
        const notebook: Notebook = {
          id,
          name: trimmed,
          content: '',
          order: notebooks.length
        }
        return { ...project, notebooks: [...notebooks, notebook] }
      })
      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return { projects }
    })
    return id
  },

  renameGlobalNotebook: (notebookId, name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }
    set((state) => {
      const globalNotebooks = state.globalNotebooks.map((notebook) =>
        notebook.id === notebookId ? { ...notebook, name: trimmed } : notebook
      )
      schedulePersist(
        state.projects,
        state.activeProjectId,
        globalNotebooks,
        state.isNotesPanelOpen
      )
      return { globalNotebooks }
    })
  },

  renameProjectNotebook: (projectId, notebookId, name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }
        return {
          ...project,
          notebooks: (project.notebooks ?? []).map((notebook) =>
            notebook.id === notebookId ? { ...notebook, name: trimmed } : notebook
          )
        }
      })
      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return { projects }
    })
  },

  deleteGlobalNotebook: (notebookId) => {
    set((state) => {
      const globalNotebooks = reindexNotebooks(
        state.globalNotebooks.filter((notebook) => notebook.id !== notebookId)
      )
      schedulePersist(
        state.projects,
        state.activeProjectId,
        globalNotebooks,
        state.isNotesPanelOpen
      )
      return { globalNotebooks }
    })
  },

  deleteProjectNotebook: (projectId, notebookId) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }
        return {
          ...project,
          notebooks: reindexNotebooks(
            (project.notebooks ?? []).filter((notebook) => notebook.id !== notebookId)
          )
        }
      })
      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return { projects }
    })
  },

  setGlobalNotebookContent: (notebookId, content) => {
    set((state) => {
      const globalNotebooks = state.globalNotebooks.map((notebook) =>
        notebook.id === notebookId ? { ...notebook, content } : notebook
      )
      schedulePersist(
        state.projects,
        state.activeProjectId,
        globalNotebooks,
        state.isNotesPanelOpen
      )
      return { globalNotebooks }
    })
  },

  setProjectNotebookContent: (projectId, notebookId, content) => {
    set((state) => {
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project
        }
        return {
          ...project,
          notebooks: (project.notebooks ?? []).map((notebook) =>
            notebook.id === notebookId ? { ...notebook, content } : notebook
          )
        }
      })
      schedulePersist(
        projects,
        state.activeProjectId,
        state.globalNotebooks,
        state.isNotesPanelOpen
      )
      return { projects }
    })
  },

  toggleNotesPanel: () => {
    set((state) => {
      const isNotesPanelOpen = !state.isNotesPanelOpen
      schedulePersist(
        state.projects,
        state.activeProjectId,
        state.globalNotebooks,
        isNotesPanelOpen
      )
      return { isNotesPanelOpen }
    })
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find((project) => project.id === activeProjectId)
  },

  getActiveTerminalId: (projectId) => {
    const state = get()
    const id = projectId ?? state.activeProjectId
    const project = state.projects.find((item) => item.id === id)
    return resolveActiveTerminalId(project, state.activeTerminalByProjectId[id])
  },

  getAttention: (terminalId) => {
    return get().attentionByTerminalId[terminalId] ?? 'idle'
  }
}))
