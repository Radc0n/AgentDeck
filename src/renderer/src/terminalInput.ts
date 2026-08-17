/**
 * xterm onData hem gerçek tuşları hem TUI protokolünü (odak, mouse, paste
 * sarmalayıcıları) yollar. Dikkat makinesi yalnızca gerçek yazıyı "kullanıcı
 * sordu" saysın.
 */

const FOCUS_REPORT = /^\x1b\[[IO]/
const SGR_MOUSE = /^\x1b\[<[\d;]*[Mm]/
const X10_MOUSE = /^\x1b\[M[\s\S]{3}/
const BRACKETED_PASTE_MARKER = /^\x1b\[20[01]~/

function stripProtocolPrefix(data: string): string {
  let rest = data
  let changed = true

  while (changed && rest.length > 0) {
    changed = false
    const next = rest
      .replace(FOCUS_REPORT, '')
      .replace(SGR_MOUSE, '')
      .replace(X10_MOUSE, '')
      .replace(BRACKETED_PASTE_MARKER, '')

    if (next !== rest) {
      rest = next
      changed = true
    }
  }

  return rest
}

/** Odak/mouse/paste işaretçisi değilse kullanıcı ajanı meşgul etmiş sayılır. */
export function isEngagingUserInput(data: string): boolean {
  return stripProtocolPrefix(data).length > 0
}
