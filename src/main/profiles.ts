import { existsSync } from 'fs'
import { join } from 'path'
import type { TerminalProfile } from '../shared/types'

export interface ResolveProfileOptions {
  cwd: string
  command?: string
  platform?: NodeJS.Platform
}

export interface SpawnSpec {
  file: string
  args: string[]
  cwd: string
}

function getPlatform(platform?: NodeJS.Platform): NodeJS.Platform {
  return platform ?? process.platform
}

function resolveWindowsShell(): SpawnSpec['file'] {
  const programFiles = process.env.ProgramFiles
  if (programFiles) {
    const pwsh = join(programFiles, 'PowerShell', '7', 'pwsh.exe')
    if (existsSync(pwsh)) {
      return pwsh
    }
  }
  return 'powershell.exe'
}

function resolveUnixShell(): SpawnSpec['file'] {
  return process.env.SHELL ?? '/bin/bash'
}

function resolveShell(platform: NodeJS.Platform): SpawnSpec['file'] {
  return platform === 'win32' ? resolveWindowsShell() : resolveUnixShell()
}

function runThroughShell(
  platform: NodeJS.Platform,
  cwd: string,
  command: string
): SpawnSpec {
  if (platform === 'win32') {
    return {
      file: resolveWindowsShell(),
      args: ['-NoLogo', '-Command', command],
      cwd
    }
  }

  const shell = resolveUnixShell()
  return {
    file: shell,
    args: ['-lc', command],
    cwd
  }
}

export function resolveProfile(
  profile: TerminalProfile,
  opts: ResolveProfileOptions
): SpawnSpec {
  const platform = getPlatform(opts.platform)
  const cwd = opts.cwd

  switch (profile) {
    case 'shell':
      return {
        file: resolveShell(platform),
        args: [],
        cwd
      }

    case 'grok':
      // Grok Build TUI — `grok` (PATH: ~/.grok/bin)
      return runThroughShell(platform, cwd, 'grok')

    case 'claude':
      return runThroughShell(platform, cwd, 'claude')

    case 'cursor':
      return runThroughShell(platform, cwd, 'cursor-agent')

    case 'codex':
      return runThroughShell(platform, cwd, 'codex')

    case 'antigravity':
      // Antigravity agent CLI — `agy` (IDE launcher `antigravity` değil)
      return runThroughShell(platform, cwd, 'agy')

    case 'custom': {
      // Kayıtlı komut çubuğu; menüde listelenmez.
      const command = opts.command?.trim()
      if (!command) {
        throw new Error('Özel profil için komut gerekli.')
      }
      return runThroughShell(platform, cwd, command)
    }

    default: {
      const exhaustive: never = profile
      throw new Error(`Bilinmeyen profil: ${exhaustive}`)
    }
  }
}
