import type { Project } from './global'

export function isMainProject(project: Project): boolean {
  return project.other !== true
}

export function partitionProjects(projects: Project[]): {
  main: Project[]
  other: Project[]
} {
  const main: Project[] = []
  const other: Project[] = []
  for (const project of projects) {
    if (isMainProject(project)) {
      main.push(project)
    } else {
      other.push(project)
    }
  }
  return { main, other }
}

export function countPinnedProjects(projects: Project[]): number {
  return projects.filter((project) => project.pinned && isMainProject(project)).length
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
  const pinned = projects.filter((project) => project.pinned && isMainProject(project))
  const unpinned = projects.filter((project) => !project.pinned && isMainProject(project))
  return [...pinned, ...unpinned]
}

/** Ana çubuk (pin önce) + Diğer rafı sırası. */
export function sortAllProjects(projects: Project[]): Project[] {
  const { main, other } = partitionProjects(projects)
  return [...sortProjectsPinnedFirst(main), ...other]
}

export type ProjectDropTarget =
  | { type: 'slot'; slot: number }
  | { type: 'other' }

/**
 * Ana çubuktaki sekmelerin ortalarına göre slot; son sekmenin sağ kenarından
 * sonrası (veya boş çubuk) "Diğer" rafına düşürür.
 */
export function resolveProjectDropTarget(
  clientX: number,
  tabRects: Array<{ left: number; width: number; right: number }>,
  overOtherDropZone: boolean
): ProjectDropTarget {
  if (overOtherDropZone) {
    return { type: 'other' }
  }

  if (tabRects.length === 0) {
    return { type: 'other' }
  }

  for (let i = 0; i < tabRects.length; i++) {
    const rect = tabRects[i]
    if (clientX < rect.left + rect.width / 2) {
      return { type: 'slot', slot: i }
    }
  }

  const last = tabRects[tabRects.length - 1]
  // Sağ yarı hâlâ ana çubuğun sonuna taşıma; kenarın biraz ötesi "Diğer"
  if (clientX <= last.right + 12) {
    return { type: 'slot', slot: tabRects.length }
  }

  return { type: 'other' }
}
