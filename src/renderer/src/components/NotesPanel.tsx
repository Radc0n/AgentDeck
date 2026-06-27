import { useState } from 'react'
import { useWorkspaceStore } from '../store/workspace'

type NotesTab = 'project' | 'global'

export function NotesPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<NotesTab>('project')

  const projects = useWorkspaceStore((state) => state.projects)
  const activeProjectId = useWorkspaceStore((state) => state.activeProjectId)
  const globalNotes = useWorkspaceStore((state) => state.globalNotes)
  const setGlobalNotes = useWorkspaceStore((state) => state.setGlobalNotes)
  const setProjectNotes = useWorkspaceStore((state) => state.setProjectNotes)

  const activeProject = projects.find((project) => project.id === activeProjectId)
  const hasActiveProject = Boolean(activeProject)
  const showProjectTab = activeTab === 'project'
  const projectNotes = activeProject?.notes ?? ''

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = event.target.value
    if (activeTab === 'global') {
      setGlobalNotes(value)
    } else if (activeProject) {
      setProjectNotes(activeProject.id, value)
    }
  }

  return (
    <aside className="notes-panel" aria-label="Notlar">
      <div className="notes-panel__header">
        <span className="notes-panel__title">Notlar</span>
      </div>

      <div className="notes-panel__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={showProjectTab}
          className={`notes-panel__tab${showProjectTab ? ' notes-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('project')}
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
          onClick={() => setActiveTab('global')}
        >
          Genel
        </button>
      </div>

      {showProjectTab && !hasActiveProject ? (
        <p className="notes-panel__empty">Proje notları için bir proje seçin.</p>
      ) : (
        <textarea
          className="notes-panel__textarea"
          value={showProjectTab ? projectNotes : globalNotes}
          onChange={handleChange}
          placeholder={
            showProjectTab ? 'Bu projeye özel notlar…' : 'Tüm projelerde geçerli notlar…'
          }
          spellCheck={false}
        />
      )}
    </aside>
  )
}
