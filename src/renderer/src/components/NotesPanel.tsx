import { useEffect, useMemo, useRef, useState } from 'react'
import type { Notebook } from '../global'
import { useWorkspaceStore } from '../store/workspace'

type NotesTab = 'project' | 'global'

function nextDefaultName(notebooks: Notebook[]): string {
  const used = new Set(notebooks.map((notebook) => notebook.name))
  let n = notebooks.length + 1
  let name = `Defter ${n}`
  while (used.has(name)) {
    n += 1
    name = `Defter ${n}`
  }
  return name
}

function previewText(content: string): string {
  const line = content.replace(/\s+/g, ' ').trim()
  if (!line) {
    return 'Boş defter'
  }
  return line.length > 48 ? `${line.slice(0, 48)}…` : line
}

export function NotesPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<NotesTab>('project')
  const [openNotebookId, setOpenNotebookId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const projects = useWorkspaceStore((state) => state.projects)
  const activeProjectId = useWorkspaceStore((state) => state.activeProjectId)
  const globalNotebooks = useWorkspaceStore((state) => state.globalNotebooks)
  const createGlobalNotebook = useWorkspaceStore((state) => state.createGlobalNotebook)
  const createProjectNotebook = useWorkspaceStore((state) => state.createProjectNotebook)
  const renameGlobalNotebook = useWorkspaceStore((state) => state.renameGlobalNotebook)
  const renameProjectNotebook = useWorkspaceStore((state) => state.renameProjectNotebook)
  const deleteGlobalNotebook = useWorkspaceStore((state) => state.deleteGlobalNotebook)
  const deleteProjectNotebook = useWorkspaceStore((state) => state.deleteProjectNotebook)
  const setGlobalNotebookContent = useWorkspaceStore(
    (state) => state.setGlobalNotebookContent
  )
  const setProjectNotebookContent = useWorkspaceStore(
    (state) => state.setProjectNotebookContent
  )

  const activeProject = projects.find((project) => project.id === activeProjectId)
  const hasActiveProject = Boolean(activeProject)
  const showProjectTab = activeTab === 'project'

  const notebooks = useMemo(() => {
    if (showProjectTab) {
      return activeProject?.notebooks ?? []
    }
    return globalNotebooks
  }, [activeProject?.notebooks, globalNotebooks, showProjectTab])

  const openNotebook = notebooks.find((notebook) => notebook.id === openNotebookId) ?? null

  useEffect(() => {
    if (openNotebookId && !notebooks.some((notebook) => notebook.id === openNotebookId)) {
      setOpenNotebookId(null)
    }
  }, [notebooks, openNotebookId])

  useEffect(() => {
    if (showProjectTab && !hasActiveProject) {
      setOpenNotebookId(null)
    }
  }, [hasActiveProject, showProjectTab])

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const switchTab = (tab: NotesTab): void => {
    setActiveTab(tab)
    setOpenNotebookId(null)
    setRenamingId(null)
    setPendingDeleteId(null)
  }

  /** Electron'da window.prompt yok/bozuk — tek tıkla oluştur + aç. */
  const handleCreate = (): void => {
    const name = nextDefaultName(notebooks)

    if (showProjectTab) {
      if (!activeProject) {
        return
      }
      const id = createProjectNotebook(activeProject.id, name)
      setPendingDeleteId(null)
      setRenamingId(null)
      setOpenNotebookId(id)
      return
    }

    const id = createGlobalNotebook(name)
    setPendingDeleteId(null)
    setRenamingId(null)
    setOpenNotebookId(id)
  }

  const beginRename = (notebook: Notebook): void => {
    setPendingDeleteId(null)
    setRenamingId(notebook.id)
    setRenameDraft(notebook.name)
  }

  const commitRename = (): void => {
    if (!renamingId) {
      return
    }
    const name = renameDraft.trim()
    if (name) {
      if (showProjectTab && activeProject) {
        renameProjectNotebook(activeProject.id, renamingId, name)
      } else {
        renameGlobalNotebook(renamingId, name)
      }
    }
    setRenamingId(null)
    setRenameDraft('')
  }

  const cancelRename = (): void => {
    setRenamingId(null)
    setRenameDraft('')
  }

  const handleDelete = (notebook: Notebook): void => {
    if (pendingDeleteId !== notebook.id) {
      setPendingDeleteId(notebook.id)
      return
    }

    if (showProjectTab && activeProject) {
      deleteProjectNotebook(activeProject.id, notebook.id)
    } else {
      deleteGlobalNotebook(notebook.id)
    }
    setPendingDeleteId(null)
    if (openNotebookId === notebook.id) {
      setOpenNotebookId(null)
    }
  }

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    if (!openNotebook) {
      return
    }
    const value = event.target.value
    if (showProjectTab && activeProject) {
      setProjectNotebookContent(activeProject.id, openNotebook.id, value)
      return
    }
    setGlobalNotebookContent(openNotebook.id, value)
  }

  return (
    <aside className="notes-panel" aria-label="Notlar">
      <div className="notes-panel__header">
        {openNotebook ? (
          <button
            type="button"
            className="notes-panel__back"
            onClick={() => {
              setOpenNotebookId(null)
              setRenamingId(null)
              setPendingDeleteId(null)
            }}
            title="Defter listesine dön"
          >
            ← Defterler
          </button>
        ) : (
          <span className="notes-panel__title">Notlar</span>
        )}
      </div>

      {!openNotebook ? (
        <div className="notes-panel__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={showProjectTab}
            className={`notes-panel__tab${showProjectTab ? ' notes-panel__tab--active' : ''}`}
            onClick={() => switchTab('project')}
            disabled={!hasActiveProject}
            title={hasActiveProject ? undefined : 'Önce bir proje seçin'}
          >
            Proje
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!showProjectTab}
            className={`notes-panel__tab${!showProjectTab ? ' notes-panel__tab--active' : ''}`}
            onClick={() => switchTab('global')}
          >
            Genel
          </button>
        </div>
      ) : (
        <div className="notes-panel__notebook-title-row">
          {renamingId === openNotebook.id ? (
            <input
              ref={renameInputRef}
              className="notes-panel__rename-input"
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitRename()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelRename()
                }
              }}
              aria-label="Defter adı"
            />
          ) : (
            <>
              <h2 className="notes-panel__notebook-title" title={openNotebook.name}>
                {openNotebook.name}
              </h2>
              <button
                type="button"
                className="notes-panel__icon-btn"
                title="Yeniden adlandır"
                aria-label="Defteri yeniden adlandır"
                onClick={() => beginRename(openNotebook)}
              >
                ✎
              </button>
            </>
          )}
        </div>
      )}

      {showProjectTab && !hasActiveProject ? (
        <p className="notes-panel__empty">Proje defterleri için bir proje seçin.</p>
      ) : openNotebook ? (
        <textarea
          className="notes-panel__textarea"
          value={openNotebook.content}
          onChange={handleContentChange}
          placeholder="Bu deftere not yaz…"
          spellCheck={false}
        />
      ) : (
        <div className="notes-panel__list-wrap">
          <button type="button" className="notes-panel__create" onClick={handleCreate}>
            + Yeni defter
          </button>

          {notebooks.length === 0 ? (
            <p className="notes-panel__empty notes-panel__empty--list">
              Henüz defter yok. Yeni bir defter oluştur.
            </p>
          ) : (
            <ul className="notes-panel__list">
              {notebooks.map((notebook) => (
                <li key={notebook.id} className="notes-panel__list-item">
                  {renamingId === notebook.id ? (
                    <input
                      ref={renameInputRef}
                      className="notes-panel__rename-input notes-panel__rename-input--row"
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitRename()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelRename()
                        }
                      }}
                      aria-label="Defter adı"
                    />
                  ) : (
                    <button
                      type="button"
                      className="notes-panel__notebook-btn"
                      onClick={() => {
                        setPendingDeleteId(null)
                        setOpenNotebookId(notebook.id)
                      }}
                    >
                      <span className="notes-panel__notebook-name">{notebook.name}</span>
                      <span className="notes-panel__notebook-preview">
                        {previewText(notebook.content)}
                      </span>
                    </button>
                  )}
                  <div className="notes-panel__notebook-actions">
                    <button
                      type="button"
                      className="notes-panel__icon-btn"
                      title="Yeniden adlandır"
                      aria-label={`${notebook.name} yeniden adlandır`}
                      onClick={() => beginRename(notebook)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={`notes-panel__icon-btn${
                        pendingDeleteId === notebook.id
                          ? ' notes-panel__icon-btn--danger-active'
                          : ' notes-panel__icon-btn--danger'
                      }`}
                      title={
                        pendingDeleteId === notebook.id
                          ? 'Tekrar tıkla: sil'
                          : 'Sil'
                      }
                      aria-label={
                        pendingDeleteId === notebook.id
                          ? `${notebook.name} silmeyi onayla`
                          : `${notebook.name} sil`
                      }
                      onClick={() => handleDelete(notebook)}
                    >
                      {pendingDeleteId === notebook.id ? '!' : '✕'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}
