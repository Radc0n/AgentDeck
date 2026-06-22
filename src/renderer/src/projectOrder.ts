import type { Project } from './global'

export function countPinnedProjects(projects: Project[]): number {
  return projects.filter((project) => project.pinned).length
}

/** Sabitlenenler solda kalır; sabitlenmeyenler yalnızca sabitlenen bloğunun sağına taşınabilir. */
export function clampProjectInsertionSlot(
  projects: Project[],
  draggingProjectId: string,
  rawSlot: number
): number {
  const fromIndex = projects.findIndex((project) => project.id === draggingProjectId)
  if (fromIndex === -1) {
    return rawSlot
  }

  const item = projects[fromIndex]
  const pinnedCount = countPinnedProjects(projects)

  if (item.pinned) {
    return Math.max(0, Math.min(pinnedCount, rawSlot))
  }

  return Math.max(pinnedCount, Math.min(projects.length, rawSlot))
}

export function sortProjectsPinnedFirst(projects: Project[]): Project[] {
  const pinned = projects.filter((project) => project.pinned)
  const unpinned = projects.filter((project) => !project.pinned)
  return [...pinned, ...unpinned]
}
