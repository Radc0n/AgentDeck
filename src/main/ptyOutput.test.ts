import { describe, expect, it } from 'vitest'
import { classifyPtyOutput } from './ptyOutput'

describe('classifyPtyOutput', () => {
  it('düz BEL bildirimi sayılır', () => {
    expect(classifyPtyOutput('\x07')).toBe('notify')
    expect(classifyPtyOutput('done\x07')).toBe('notify')
  })

  it('OSC 9 / 99 / 777 bildirimi sayılır', () => {
    expect(classifyPtyOutput('\x1b]9;turn complete\x07')).toBe('notify')
    expect(classifyPtyOutput('\x1b]99;i=1:d=0:p=body;done\x07')).toBe('notify')
    expect(classifyPtyOutput('\x1b]777;notify;Grok;Cevap hazir\x1b\\')).toBe('notify')
  })

  it('OSC 9;4 progress, 9;9 cwd ve 777 precmd gürültüdür', () => {
    expect(classifyPtyOutput('\x1b]9;4;1;40\x07')).toBe('noise')
    expect(classifyPtyOutput('\x1b]9;9;C:\\proj\x07')).toBe('noise')
    expect(classifyPtyOutput('\x1b]777;precmd\x07')).toBe('noise')
    expect(classifyPtyOutput('\x1b]0;✳ Grok\x07')).toBe('noise')
    expect(classifyPtyOutput('\x1b]2;session\x07')).toBe('noise')
    expect(classifyPtyOutput('\x1b]104;255\x07')).toBe('noise')
  })

  it('yalnız CSI yeniden çizimi gürültüdür', () => {
    expect(classifyPtyOutput('\x1b[2J\x1b[H\x1b[0m')).toBe('noise')
  })

  it('görünür metin içeriktir', () => {
    expect(classifyPtyOutput('ajan cevabı')).toBe('content')
    expect(classifyPtyOutput('\x1b[2mthinking\x1b[0m')).toBe('content')
  })
})
