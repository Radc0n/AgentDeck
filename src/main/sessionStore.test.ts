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

    expect(loaded).toEqual(workspace)
  })

  it('dosya yoksa boş varsayılan oturum döner', () => {
    const userDataDir = createTempUserDataDir()
    tempDirs.push(userDataDir)

    const loaded = loadWorkspace(userDataDir)

    expect(loaded).toEqual({
      schemaVersion: 1,
      projects: [],
      activeProjectId: ''
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
      activeProjectId: ''
    })
    expect(existsSync(`${filePath}.bak`)).toBe(true)
    expect(readFileSync(`${filePath}.bak`, 'utf8')).toBe('{ bozuk json')
  })
})
