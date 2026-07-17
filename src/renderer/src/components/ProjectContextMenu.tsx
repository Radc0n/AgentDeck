import { useEffect, useRef } from 'react'
import type { Project } from '../global'

interface ProjectContextMenuProps {
  project: Project
  x: number
  y: number
  onClose: () => void
  onTogglePin: () => void
  onRevealInFolder: () => void
  onRemove: () => void
  folderAccessible: boolean
}

export function ProjectContextMenu({
  project,
  x,
  y,
  onClose,
  onTogglePin,
  onRevealInFolder,
  onRemove,
  folderAccessible
}: ProjectContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) {
        return
      }
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) {
      return
    }

    const rect = menu.getBoundingClientRect()
    const padding = 8
    let left = x
    let top = y

    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = window.innerHeight - rect.height - padding
    }

    menu.style.left = `${Math.max(padding, left)}px`
    menu.style.top = `${Math.max(padding, top)}px`
  }, [x, y])

  return (
    <div
      ref={menuRef}
      className="project-context-menu"
      role="menu"
      aria-label={`${project.name} proje menüsü`}
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        role="menuitem"
        className="project-context-menu__item"
        onClick={() => {
          onTogglePin()
          onClose()
        }}
      >
        {project.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
      </button>
      <button
        type="button"
        role="menuitem"
        className="project-context-menu__item"
        disabled={!folderAccessible}
        onClick={() => {
          onRevealInFolder()
          onClose()
        }}
      >
        Klasörde gör
      </button>
      <div className="project-context-menu__separator" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="project-context-menu__item project-context-menu__item--danger"
        onClick={() => {
          onRemove()
          onClose()
        }}
      >
        Kaldır
      </button>
    </div>
  )
}
