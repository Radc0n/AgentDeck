import { describe, expect, it } from 'vitest'
import {
  validateAttentionDismissRequest,
  validateCreateTerminalRequest,
  validateTerminalResizeRequest,
  validateTerminalWriteRequest,
  validateWorkspace
} from './ipcValidation'

describe('IPC validation', () => {
  it('geçerli terminal yazma isteğini kabul eder', () => {
    expect(validateTerminalWriteRequest({ terminalId: 'term-1', data: 'hello' })).toEqual({
      terminalId: 'term-1',
      data: 'hello'
    })
  })

  it('geçersiz terminal kimliğini reddeder', () => {
    expect(() =>
      validateTerminalWriteRequest({ terminalId: '../term', data: 'hello' })
    ).toThrow('Terminal kimliği geçersiz.')
  })

  it('aşırı terminal boyutunu reddeder', () => {
    expect(() =>
      validateTerminalResizeRequest({ terminalId: 'term-1', cols: 5000, rows: 24 })
    ).toThrow('Terminal boyutu geçersiz.')
  })

  it('özel olmayan profile komut eklenmesini reddeder', () => {
    expect(() =>
      validateCreateTerminalRequest({
        id: 'term-1',
        profile: 'shell',
        cwd: process.cwd(),
        command: 'whoami'
      })
    ).toThrow('özel komut kabul etmiyor')
  })

  it('dikkat terminal listesini tekilleştirir', () => {
    expect(
      validateAttentionDismissRequest({ terminalIds: ['term-1', 'term-1', 'term-2'] })
    ).toEqual({ terminalIds: ['term-1', 'term-2'] })
  })

  it('temel çalışma alanı şeklini doğrular', () => {
    const workspace = {
      schemaVersion: 1,
      projects: [],
      activeProjectId: '',
      globalNotebooks: []
    }
    expect(validateWorkspace(workspace)).toBe(workspace)
  })
})
