import { describe, expect, it } from 'vitest'
import type { Project } from './global'
import {
  clampProjectInsertionSlot,
  partitionProjects,
  resolveProjectDropTarget,
  sortAllProjects,
  sortProjectsPinnedFirst
} from './projectOrder'

function project(id: string, pinned = false, other = false): Project {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    terminals: [],
    savedCommands: [],
    pinned,
    other
  }
}

describe('projectOrder', () => {
  it('sabitlenmeyen projeyi sabitlenenlerin soluna taşımayı engeller', () => {
    const projects = [project('a', true), project('b', false), project('c', false)]

    expect(clampProjectInsertionSlot(projects, 'b', 0)).toBe(1)
    expect(clampProjectInsertionSlot(projects, 'c', 0)).toBe(1)
  })

  it('sabitlenen projeyi sabitlenmeyenlerin arasına taşımayı engeller', () => {
    const projects = [project('a', true), project('b', true), project('c', false)]

    expect(clampProjectInsertionSlot(projects, 'a', 3)).toBe(2)
    expect(clampProjectInsertionSlot(projects, 'b', 3)).toBe(2)
  })

  it('sabitlenenleri öne, sabitlenmeyenleri arkaya sıralar', () => {
    const projects = [project('x', false), project('a', true), project('b', false)]

    expect(sortProjectsPinnedFirst(projects).map((item) => item.id)).toEqual(['a', 'x', 'b'])
  })

  it('Diğer projelerini ana listeden ayırır', () => {
    const projects = [project('a'), project('b', false, true), project('c', true)]
    const { main, other } = partitionProjects(projects)

    expect(main.map((item) => item.id)).toEqual(['a', 'c'])
    expect(other.map((item) => item.id)).toEqual(['b'])
  })

  it('sortAllProjects pin + other sırasını korur', () => {
    const projects = [
      project('x', false),
      project('o1', false, true),
      project('a', true),
      project('o2', false, true)
    ]

    expect(sortAllProjects(projects).map((item) => item.id)).toEqual([
      'a',
      'x',
      'o1',
      'o2'
    ])
  })

  it('son sekmenin sağ kenarından sonrası Diğer hedefine gider', () => {
    const rects = [
      { left: 0, width: 80, right: 80 },
      { left: 90, width: 80, right: 170 }
    ]

    expect(resolveProjectDropTarget(30, rects, false)).toEqual({ type: 'slot', slot: 0 })
    expect(resolveProjectDropTarget(100, rects, false)).toEqual({ type: 'slot', slot: 1 })
    expect(resolveProjectDropTarget(160, rects, false)).toEqual({ type: 'slot', slot: 2 })
    expect(resolveProjectDropTarget(200, rects, false)).toEqual({ type: 'other' })
  })

  it('Diğer drop zone üzerine gelince other döner', () => {
    const rects = [{ left: 100, width: 80, right: 180 }]
    expect(resolveProjectDropTarget(50, rects, true)).toEqual({ type: 'other' })
  })
})
