import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Project } from '../global'
import {
  clampProjectInsertionSlot,
  partitionProjects,
  resolveProjectDropTarget,
  type ProjectDropTarget
} from '../projectOrder'
import { projectHasUnreadAttention } from '../projectAttention'
import { useWorkspaceStore } from '../store/workspace'
import { ProjectContextMenu } from './ProjectContextMenu'

function createProjectFromPath(path: string, name?: string): Project {
  const segments = path.split(/[/\\]/)
  const fallbackName = segments[segments.length - 1] || 'Proje'

  return {
    id: crypto.randomUUID(),
    name: name ?? fallbackName,
    path,
    terminals: [],
    savedCommands: []
  }
}

const DRAG_THRESHOLD_PX = 6

interface ContextMenuState {
  projectId: string
  x: number
  y: number
}

function projectTabClassName(
  project: Project,
  isActive: boolean,
  isInaccessible: boolean
): string {
  const hasTerminals = project.terminals.length > 0
  return [
    'project-tab',
    isActive ? 'project-tab--active' : '',
    isInaccessible ? 'project-tab--inaccessible' : '',
    project.pinned ? 'project-tab--pinned' : '',
    hasTerminals ? 'project-tab--has-terminals' : 'project-tab--idle'
  ]
    .filter(Boolean)
    .join(' ')
}

export function ProjectTabs(): React.JSX.Element {
  const projects = useWorkspaceStore((state) => state.projects)
  const activeProjectId = useWorkspaceStore((state) => state.activeProjectId)
  const attentionByTerminalId = useWorkspaceStore((state) => state.attentionByTerminalId)
  const setActiveProject = useWorkspaceStore((state) => state.setActiveProject)
  const removeProject = useWorkspaceStore((state) => state.removeProject)
  const togglePinProject = useWorkspaceStore((state) => state.togglePinProject)
  const setProjectOther = useWorkspaceStore((state) => state.setProjectOther)
  const reorderMainProjects = useWorkspaceStore((state) => state.reorderMainProjects)
  const addProject = useWorkspaceStore((state) => state.addProject)
  const hydrate = useWorkspaceStore((state) => state.hydrate)
  const [inaccessibleProjectIds, setInaccessibleProjectIds] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<ProjectDropTarget | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherPanelPos, setOtherPanelPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0
  })
  const dragStartRef = useRef<{ id: string; startX: number; didDrag: boolean } | null>(null)
  const tabRefs = useRef<(HTMLDivElement | null)[]>([])
  const otherButtonRef = useRef<HTMLButtonElement | null>(null)
  const otherPanelRef = useRef<HTMLDivElement | null>(null)

  const updateOtherPanelPosition = (): void => {
    const button = otherButtonRef.current
    if (!button) {
      return
    }

    const rect = button.getBoundingClientRect()
    const padding = 8
    const panelWidth = Math.min(360, window.innerWidth - padding * 2)
    // Sağdaki butona hizala (panel sağ kenarı ≈ buton sağ kenarı)
    let left = rect.right - panelWidth
    let top = rect.bottom + 8

    if (left < padding) {
      left = padding
    }
    if (left + panelWidth > window.innerWidth - padding) {
      left = window.innerWidth - panelWidth - padding
    }

    const estimatedHeight = 280
    if (top + estimatedHeight > window.innerHeight - padding) {
      top = Math.max(padding, rect.top - estimatedHeight - 8)
    }

    setOtherPanelPos({ top, left })
  }

  const openOtherPanel = (): void => {
    updateOtherPanelPosition()
    setOtherOpen(true)
  }

  const toggleOtherPanel = (): void => {
    if (otherOpen) {
      setOtherOpen(false)
      return
    }
    openOtherPanel()
  }

  const { main: mainProjects, other: otherProjects } = useMemo(
    () => partitionProjects(projects),
    [projects]
  )

  const activeIsInOther = useMemo(() => {
    const active = projects.find((project) => project.id === activeProjectId)
    return active?.other === true
  }, [projects, activeProjectId])

  const otherHasUnread = useMemo(
    () =>
      otherProjects.some((project) =>
        projectHasUnreadAttention(project, attentionByTerminalId)
      ),
    [otherProjects, attentionByTerminalId]
  )

  useEffect(() => {
    let cancelled = false

    void window.agentdeck.loadWorkspace().then((workspace) => {
      if (cancelled) {
        return
      }

      hydrate(workspace)
      void window.agentdeck.resetAttentionSession()
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

  useEffect(() => {
    if (!otherOpen) {
      return
    }

    updateOtherPanelPosition()

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (otherPanelRef.current?.contains(target) || otherButtonRef.current?.contains(target)) {
        return
      }
      setOtherOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOtherOpen(false)
      }
    }

    const handleReposition = (): void => {
      updateOtherPanelPosition()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReposition)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReposition)
    }
  }, [otherOpen])

  const isOverOtherDropZone = (clientX: number, clientY: number): boolean => {
    const el = otherButtonRef.current
    if (!el) {
      return false
    }
    const rect = el.getBoundingClientRect()
    const pad = 10
    return (
      clientX >= rect.left - pad &&
      clientX <= rect.right + pad &&
      clientY >= rect.top - pad &&
      clientY <= rect.bottom + pad
    )
  }

  const resolveDropTarget = (clientX: number, clientY: number): ProjectDropTarget => {
    const overOther = isOverOtherDropZone(clientX, clientY)

    const rects = tabRefs.current
      .slice(0, mainProjects.length)
      .map((el) => {
        if (!el) {
          return null
        }
        const { left, width, right } = el.getBoundingClientRect()
        return { left, width, right }
      })
      .filter((rect): rect is { left: number; width: number; right: number } => rect !== null)

    return resolveProjectDropTarget(clientX, rects, overOther)
  }

  const resetDrag = (): void => {
    dragStartRef.current = null
    setDraggingId(null)
    setDropTarget(null)
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
      setOtherOpen(false)
    }

    if (drag.didDrag) {
      const target = resolveDropTarget(event.clientX, event.clientY)
      if (target.type === 'slot') {
        setDropTarget({
          type: 'slot',
          slot: clampProjectInsertionSlot(mainProjects, drag.id, target.slot)
        })
      } else {
        setDropTarget(target)
      }
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
      const target = resolveDropTarget(event.clientX, event.clientY)
      if (target.type === 'other') {
        setProjectOther(drag.id, true)
      } else {
        const fromIndex = mainProjects.findIndex((project) => project.id === drag.id)
        const toSlot = clampProjectInsertionSlot(mainProjects, drag.id, target.slot)
        if (fromIndex !== -1) {
          reorderMainProjects(fromIndex, toSlot)
        }
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

  const handleAddProject = async (): Promise<void> => {
    try {
      const result = await window.agentdeck.addProject()
      if (!result.path) {
        return
      }

      const project = createProjectFromPath(result.path, result.name)
      addProject(project)
      setActiveProject(project.id)
    } catch (error) {
      console.error('Proje eklenemedi:', error)
    }
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

  const isDragging = draggingId !== null
  const isDroppingOnOther = isDragging && dropTarget?.type === 'other'
  const insertionSlot =
    isDragging && dropTarget?.type === 'slot' ? dropTarget.slot : null

  const contextProject = contextMenu
    ? projects.find((project) => project.id === contextMenu.projectId)
    : undefined

  const addProjectButton = (
    <button
      type="button"
      className="project-tabs__add"
      onClick={() => void handleAddProject()}
      title="Yeni proje ekle"
      aria-label="Yeni proje ekle"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M7 2.5v9M2.5 7h9" />
      </svg>
    </button>
  )

  const renderMainProjectTab = (project: Project, index: number): React.JSX.Element => {
    const isActive = project.id === activeProjectId
    const isInaccessible = inaccessibleProjectIds.has(project.id)
    const isItemDragging = draggingId === project.id
    const hasUnread = projectHasUnreadAttention(project, attentionByTerminalId)

    return (
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
          className={projectTabClassName(project, isActive, isInaccessible)}
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
          <span className="project-tab__name">{project.name}</span>
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
    )
  }

  return (
    <>
      <div
        className={`project-tabs${mainProjects.length === 0 ? ' project-tabs--empty' : ''}`}
        role="tablist"
        aria-label="Projeler"
      >
        {mainProjects.length === 0 ? (
          <span className="project-tabs__empty-label">Aktif proje yok</span>
        ) : null}

        {mainProjects.map((project, index) => (
          <Fragment key={project.id}>
            {isDragging && insertionSlot === index ? (
              <div className="project-tabs__insertion-line" aria-hidden="true" />
            ) : null}
            {renderMainProjectTab(project, index)}
          </Fragment>
        ))}

        {isDragging && insertionSlot === mainProjects.length ? (
          <div className="project-tabs__insertion-line" aria-hidden="true" />
        ) : null}

        {isDragging ? (
          <div
            className={`project-tabs__other-drop${
              isDroppingOnOther ? ' project-tabs__other-drop--active' : ''
            }`}
            aria-hidden="true"
          >
            <span>→ Diğer</span>
          </div>
        ) : null}

        {addProjectButton}

        <div className="project-tabs__divider project-tabs__divider--before-other" aria-hidden="true" />

        <div className="project-other">
          <button
            ref={otherButtonRef}
            type="button"
            className={[
              'project-other__trigger',
              otherOpen ? 'project-other__trigger--open' : '',
              activeIsInOther ? 'project-other__trigger--active' : '',
              isDroppingOnOther ? 'project-other__trigger--drop-target' : '',
              otherHasUnread ? 'project-other__trigger--unread' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            aria-expanded={otherOpen}
            aria-haspopup="dialog"
            aria-label={`Diğer projeler${otherProjects.length > 0 ? `, ${otherProjects.length} adet` : ''}`}
            title="Diğer projeler — buraya sürükleyerek rafına al"
            onClick={toggleOtherPanel}
          >
            <span className="project-other__icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4.2c.4 0 .78.16 1.06.44L12 7.7l1.24-1.26c.28-.28.66-.44 1.06-.44H18.5A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 10h16"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="project-other__label">Diğer</span>
            {otherProjects.length > 0 ? (
              <span className="project-other__count">{otherProjects.length}</span>
            ) : null}
            {otherHasUnread ? (
              <span className="project-other__unread-dot" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      </div>

      {otherOpen
        ? createPortal(
            <div
              ref={otherPanelRef}
              className="project-other__panel"
              role="dialog"
              aria-label="Diğer projeler"
              style={{ top: otherPanelPos.top, left: otherPanelPos.left }}
            >
              <div className="project-other__panel-head">
                <div className="project-other__panel-title">
                  <span className="project-other__panel-kicker">Raf</span>
                  <span>Diğer projeler</span>
                </div>
                <p className="project-other__panel-hint">
                  Aktif çalışmadığın projeleri buraya taşı. En sağa sürüklemek de aynı işi
                  yapar.
                </p>
              </div>

              {otherProjects.length === 0 ? (
                <div className="project-other__empty">
                  <div className="project-other__empty-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4.2c.4 0 .78.16 1.06.44L12 7.7l1.24-1.26c.28-.28.66-.44 1.06-.44H18.5A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="project-other__empty-title">Raf boş</p>
                  <p className="project-other__empty-text">
                    Bir projeyi buraya veya çubuğun en sağına sürükle.
                  </p>
                </div>
              ) : (
                <ul className="project-other__list">
                  {otherProjects.map((project) => {
                    const isActive = project.id === activeProjectId
                    const isInaccessible = inaccessibleProjectIds.has(project.id)
                    const hasUnread = projectHasUnreadAttention(
                      project,
                      attentionByTerminalId
                    )
                    const hasTerminals = project.terminals.length > 0

                    return (
                      <li key={project.id} className="project-other__row">
                        <button
                          type="button"
                          className={[
                            'project-other__item',
                            isActive ? 'project-other__item--active' : '',
                            hasTerminals ? 'project-other__item--has-terminals' : '',
                            isInaccessible ? 'project-other__item--inaccessible' : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => {
                            setActiveProject(project.id)
                            setOtherOpen(false)
                          }}
                        >
                          <span className="project-other__item-main">
                            <span className="project-other__item-name">{project.name}</span>
                            <span className="project-other__item-path" title={project.path}>
                              {project.path}
                            </span>
                          </span>
                          <span className="project-other__item-meta">
                            {hasTerminals ? (
                              <span className="project-other__item-terms">
                                {project.terminals.length} term
                              </span>
                            ) : (
                              <span className="project-other__item-idle">boş</span>
                            )}
                            {hasUnread ? (
                              <span
                                className="project-tab__unread"
                                aria-label="Okunmamış bildirim"
                              />
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="project-other__restore"
                          title="Ana çubuğa geri al"
                          aria-label={`${project.name} projesini ana çubuğa geri al`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setProjectOther(project.id, false)
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M9 14 4 9l5-5" />
                            <path d="M4 9h10.5a5.5 5.5 0 1 1 0 11H12" />
                          </svg>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>,
            document.body
          )
        : null}

      {contextProject && contextMenu ? (
        <ProjectContextMenu
          project={contextProject}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onTogglePin={() => togglePinProject(contextProject.id)}
          onToggleOther={() => setProjectOther(contextProject.id, !contextProject.other)}
          onRevealInFolder={() => {
            void window.agentdeck.revealProjectInFolder(contextProject.path)
          }}
          folderAccessible={!inaccessibleProjectIds.has(contextProject.id)}
          onRemove={() => void handleRemoveProject(contextProject.id, contextProject.name)}
        />
      ) : null}
    </>
  )
}
