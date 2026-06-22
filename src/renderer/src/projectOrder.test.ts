import { describe, expect, it } from 'vitest'
import type { Project } from './global'
import { clampProjectInsertionSlot, sortProjectsPinnedFirst } from './projectOrder'

function project(id: string, pinned = false): Project {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    terminals: [],
    savedCommands: [],
    pinned
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
})
