import { Fragment, useEffect, useRef, useState } from 'react'
import { clampProjectInsertionSlot } from '../projectOrder'
import { projectHasUnreadAttention } from '../projectAttention'
import { useWorkspaceStore } from '../store/workspace'
import { ProjectContextMenu } from './ProjectContextMenu'

const DRAG_THRESHOLD_PX = 6

interface ContextMenuState {
  projectId: string
  x: number
  y: number
}

export function ProjectTabs(): React.JSX.Element {
  const projects = useWorkspaceStore((state) => state.projects)
  const activeProjectId = useWorkspaceStore((state) => state.activeProjectId)
  const attentionByTerminalId = useWorkspaceStore((state) => state.attentionByTerminalId)
  const setActiveProject = useWorkspaceStore((state) => state.setActiveProject)
  const removeProject = useWorkspaceStore((state) => state.removeProject)
  const togglePinProject = useWorkspaceStore((state) => state.togglePinProject)
  const reorderProjects = useWorkspaceStore((state) => state.reorderProjects)
  const hydrate = useWorkspaceStore((state) => state.hydrate)
  const [inaccessibleProjectIds, setInaccessibleProjectIds] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [insertionSlot, setInsertionSlot] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const dragStartRef = useRef<{ id: string; startX: number; didDrag: boolean } | null>(null)
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let cancelled = false

    void window.agentdeck.loadWorkspace().then((workspace) => {
      if (cancelled) {
        return
      }

      hydrate(workspace)
      setHydrated(true)
    })

    return () => {
      cancelled = true
    }
  }, [hydrate])

  useEffect(() => {
    if (!hydrated || projects.length === 0) {
      setInaccessibleProjectIds(new Set())
      return
    }

    let cancelled = false

    void Promise.all(
      projects.map(async (project) => {
        const accessible = await window.agentdeck.checkProjectPath(project.path)
        return accessible ? null : project.id
      })
    ).then((results) => {
      if (cancelled) {
        return
      }

      setInaccessibleProjectIds(
        new Set(results.filter((projectId): projectId is string => projectId !== null))
      )
    })

    return () => {
      cancelled = true
    }
  }, [hydrated, projects])

  const resolveInsertionSlot = (clientX: number): number => {
    const refs = tabRefs.current
    for (let i = 0; i < refs.length; i++) {
      const el = refs[i]
      if (!el) {
        continue
      }

      const { left, width } = el.getBoundingClientRect()
      if (clientX < left + width / 2) {
        return i
      }
    }

    return refs.length
  }

  const resetDrag = (): void => {
    dragStartRef.current = null
    setDraggingId(null)
    setInsertionSlot(null)
  }

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    projectId: string
  ): void => {
    if (event.button !== 0) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = { id: projectId, startX: event.clientX, didDrag: false }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragStartRef.current
    if (!drag) {
      return
    }

    if (!drag.didDrag && Math.abs(event.clientX - drag.startX) >= DRAG_THRESHOLD_PX) {
      drag.didDrag = true
      setDraggingId(drag.id)
    }

    if (drag.didDrag) {
      const rawSlot = resolveInsertionSlot(event.clientX)
      setInsertionSlot(clampProjectInsertionSlot(projects, drag.id, rawSlot))
    }
  }

  const handlePointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
    projectId: string
  ): void => {
    const drag = dragStartRef.current
    if (!drag) {
      return
    }

    if (drag.didDrag) {
      const fromIndex = projects.findIndex((project) => project.id === drag.id)
      const rawSlot = resolveInsertionSlot(event.clientX)
      const toSlot = clampProjectInsertionSlot(projects, drag.id, rawSlot)
      if (fromIndex !== -1) {
        reorderProjects(fromIndex, toSlot)
      }
    } else {
      setActiveProject(projectId)
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    resetDrag()
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    resetDrag()
  }

  const handleRemoveProject = async (projectId: string, projectName: string): Promise<void> => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) {
      return
    }

    const confirmed = window.confirm(`"${projectName}" projesi kaldırılsın mı?`)
    if (!confirmed) {
      return
    }

    await Promise.allSettled(
      project.terminals.map((terminal) =>
        window.agentdeck.killTerminal({ terminalId: terminal.id })
      )
    )
    removeProject(projectId)
  }

  if (projects.length === 0) {
    return <div className="project-tabs project-tabs--empty">Proje yok</div>
  }

  const isDragging = draggingId !== null
  const contextProject = contextMenu
    ? projects.find((project) => project.id === contextMenu.projectId)
    : undefined

  return (
    <>
      <div className="project-tabs" role="tablist" aria-label="Projeler">
      {projects.map((project, index) => {
        const isActive = project.id === activeProjectId
        const isInaccessible = inaccessibleProjectIds.has(project.id)
        const isItemDragging = draggingId === project.id
        const hasUnread = projectHasUnreadAttention(
          project,
          attentionByTerminalId,
          activeProjectId
        )

        return (
          <Fragment key={project.id}>
            {isDragging && insertionSlot === index ? (
              <div className="project-tabs__insertion-line" aria-hidden="true" />
            ) : null}

            <div
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              className={[
                'project-tab-wrap',
                isInaccessible ? 'project-tab-wrap--inaccessible' : '',
                isItemDragging ? 'project-tab-wrap--dragging' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerDown={(event) => handlePointerDown(event, project.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => handlePointerUp(event, project.id)}
              onPointerCancel={handlePointerCancel}
              onContextMenu={(event) => {
                event.preventDefault()
                setContextMenu({ projectId: project.id, x: event.clientX, y: event.clientY })
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={`project-tab${isActive ? ' project-tab--active' : ''}${
                  isInaccessible ? ' project-tab--inaccessible' : ''
                }${project.pinned ? ' project-tab--pinned' : ''}`}
              >
                {project.pinned ? (
                  <svg
                    className="project-tab__pin"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                ) : null}
                {project.name}
                {hasUnread ? (
                  <span className="project-tab__unread" aria-label="Okunmamış bildirim" />
                ) : null}
                {isInaccessible ? (
                  <span className="project-tab__badge" title="Proje klasörüne erişilemiyor">
                    erişilemez
                  </span>
                ) : null}
              </button>
            </div>
          </Fragment>
        )
      })}

      {isDragging && insertionSlot === projects.length ? (
        <div className="project-tabs__insertion-line" aria-hidden="true" />
      ) : null}
      </div>

      {contextProject && contextMenu ? (
        <ProjectContextMenu
          project={contextProject}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onTogglePin={() => togglePinProject(contextProject.id)}
          onRemove={() => void handleRemoveProject(contextProject.id, contextProject.name)}
        />
      ) : null}
    </>
  )
}
