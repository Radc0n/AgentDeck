import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Workspace } from '../shared/types'
import { getWorkspaceFilePath, loadWorkspace, saveWorkspace } from './sessionStore'

function createTempUserDataDir(): string {
  return mkdtempSync(join(tmpdir(), 'agentdeck-test-'))
}

describe('sessionStore', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('kaydet → yükle round-trip veriyi korur', () => {
    const userDataDir = createTempUserDataDir()
    tempDirs.push(userDataDir)

    const workspace: Workspace = {
      schemaVersion: 1,
      activeProjectId: 'proje-1',
      projects: [
        {
          id: 'proje-1',
          name: 'AgentDeck',
          path: 'C:\\projeler\\agentdeck',
          pinned: false,
          terminals: [
            {
              id: 'term-1',
              name: 'Kabuk',
              profile: 'shell',
              cwd: 'C:\\projeler\\agentdeck',
              order: 0
            }
          ],
          savedCommands: [
            {
              id: 'cmd-1',
              label: 'dev',
              command: 'npm run dev'
            }
          ]
        }
      ]
    }

    saveWorkspace(workspace, userDataDir)
    const loaded = loadWorkspace(userDataDir)

    expect(loaded).toEqual({
      ...workspace,
      globalNotebooks: [],
      notesPanelOpen: false,
      projects: workspace.projects.map((project) => ({
        ...project,
        other: false,
        notebooks: []
      }))
    })
  })

  it('dosya yoksa boş varsayılan oturum döner', () => {
    const userDataDir = createTempUserDataDir()
    tempDirs.push(userDataDir)

    const loaded = loadWorkspace(userDataDir)

    expect(loaded).toEqual({
      schemaVersion: 1,
      projects: [],
      activeProjectId: '',
      globalNotebooks: [],
      notesPanelOpen: false
    })
    expect(existsSync(getWorkspaceFilePath(userDataDir))).toBe(false)
  })

  it('bozuk JSON yedeklenir ve varsayılan oturum döner', () => {
    const userDataDir = createTempUserDataDir()
    tempDirs.push(userDataDir)

    const filePath = getWorkspaceFilePath(userDataDir)
    writeFileSync(filePath, '{ bozuk json', 'utf8')

    const loaded = loadWorkspace(userDataDir)

    expect(loaded).toEqual({
      schemaVersion: 1,
      projects: [],
      activeProjectId: '',
      globalNotebooks: [],
      notesPanelOpen: false
    })
    expect(existsSync(`${filePath}.bak`)).toBe(true)
    expect(readFileSync(`${filePath}.bak`, 'utf8')).toBe('{ bozuk json')
  })

  it('eski notes / globalNotes alanlarını defterlere migrate eder', () => {
    const userDataDir = createTempUserDataDir()
    tempDirs.push(userDataDir)

    const workspace: Workspace = {
      schemaVersion: 1,
      activeProjectId: 'proje-1',
      globalNotes: 'tüm projeler için genel not',
      notesPanelOpen: true,
      projects: [
        {
          id: 'proje-1',
          name: 'AgentDeck',
          path: 'C:\\projeler\\agentdeck',
          pinned: false,
          terminals: [],
          savedCommands: [],
          notes: 'projeye özel not'
        }
      ]
    }

    saveWorkspace(workspace, userDataDir)
    const loaded = loadWorkspace(userDataDir)

    expect(loaded.notesPanelOpen).toBe(true)
    expect(loaded.globalNotebooks).toHaveLength(1)
    expect(loaded.globalNotebooks?.[0].name).toBe('Notlar')
    expect(loaded.globalNotebooks?.[0].content).toBe('tüm projeler için genel not')
    expect(loaded.projects[0].notebooks).toHaveLength(1)
    expect(loaded.projects[0].notebooks?.[0].content).toBe('projeye özel not')
  })

  it('notebooks alanını round-trip korur', () => {
    const userDataDir = createTempUserDataDir()
    tempDirs.push(userDataDir)

    const workspace: Workspace = {
      schemaVersion: 1,
      activeProjectId: 'proje-1',
      notesPanelOpen: true,
      globalNotebooks: [
        { id: 'gn1', name: 'Genel A', content: 'g', order: 0 },
        { id: 'gn2', name: 'Genel B', content: 'h', order: 1 }
      ],
      projects: [
        {
          id: 'proje-1',
          name: 'AgentDeck',
          path: 'C:\\projeler\\agentdeck',
          pinned: false,
          terminals: [],
          savedCommands: [],
          notebooks: [{ id: 'pn1', name: 'Sprint', content: 'todo', order: 0 }]
        }
      ]
    }

    saveWorkspace(workspace, userDataDir)
    const loaded = loadWorkspace(userDataDir)

    expect(loaded.globalNotebooks).toEqual(workspace.globalNotebooks)
    expect(loaded.projects[0].notebooks).toEqual(workspace.projects[0].notebooks)
  })

  it('not alanları olmayan eski workspace güvenli varsayılana düşer', () => {
    const userDataDir = createTempUserDataDir()
    tempDirs.push(userDataDir)

    const filePath = getWorkspaceFilePath(userDataDir)
    writeFileSync(
      filePath,
      JSON.stringify({
        schemaVersion: 1,
        activeProjectId: '',
        projects: [
          { id: 'p', name: 'Eski', path: 'C:\\eski', terminals: [], savedCommands: [] }
        ]
      }),
      'utf8'
    )

    const loaded = loadWorkspace(userDataDir)

    expect(loaded.globalNotebooks).toEqual([])
    expect(loaded.notesPanelOpen).toBe(false)
    expect(loaded.projects[0].notebooks).toEqual([])
  })
})
