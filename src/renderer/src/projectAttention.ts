import type { AttentionState, Project } from './global'

export function projectHasUnreadAttention(
  project: Project,
  attentionByTerminalId: Record<string, AttentionState>,
  activeProjectId: string
): boolean {
  if (project.id === activeProjectId) {
    return false
  }

  return project.terminals.some(
    (terminal) => attentionByTerminalId[terminal.id] === 'needsAttention'
  )
}
