import type { AttentionState, Project } from './global'

export function projectHasUnreadAttention(
  project: Project,
  attentionByTerminalId: Record<string, AttentionState>
): boolean {
  return project.terminals.some(
    (terminal) => attentionByTerminalId[terminal.id] === 'needsAttention'
  )
}
