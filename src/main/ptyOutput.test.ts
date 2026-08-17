import { describe, expect, it } from 'vitest'
import { classifyPtyOutput, looksLikeBlockingPrompt } from './ptyOutput'

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

  it('başlık ve OSC 9;4 progress canlılık sayılır', () => {
    expect(classifyPtyOutput('\x1b]9;4;1;40\x07')).toBe('activity')
    expect(classifyPtyOutput('\x1b]0;✳ Grok\x07')).toBe('activity')
    expect(classifyPtyOutput('\x1b]2;session\x07')).toBe('activity')
  })

  it('OSC 9;9 cwd, 777 precmd ve renk gürültüdür', () => {
    expect(classifyPtyOutput('\x1b]9;9;C:\\proj\x07')).toBe('noise')
    expect(classifyPtyOutput('\x1b]777;precmd\x07')).toBe('noise')
    expect(classifyPtyOutput('\x1b]104;255\x07')).toBe('noise')
  })

  it('yalnız CSI yeniden çizimi gürültüdür', () => {
    expect(classifyPtyOutput('\x1b[2J\x1b[H\x1b[0m')).toBe('noise')
  })

  it('görünür metin içeriktir', () => {
    expect(classifyPtyOutput('ajan cevabı')).toBe('content')
    expect(classifyPtyOutput('\x1b[2mthinking\x1b[0m')).toBe('content')
  })

  it('Grok seçmeli soru kartı bildirimi sayılır', () => {
    expect(looksLikeBlockingPrompt('z (o) Type your answer here')).toBe(true)
    expect(
      classifyPtyOutput('1 (o) Kısa tek satır\r\nz (o) Type your answer here')
    ).toBe('notify')
    expect(classifyPtyOutput('↑/↓ navigate · y copy')).toBe('notify')
  })

  it('onay kartı da bildirimi sayılır', () => {
    expect(classifyPtyOutput('Always allow on all sessions')).toBe('notify')
  })

  it('sıradan metindeki navigate/copy bildirim değildir', () => {
    expect(looksLikeBlockingPrompt('please navigate the repo then copy files')).toBe(
      false
    )
    expect(classifyPtyOutput('please navigate the repo then copy files')).toBe(
      'content'
    )
  })
})
