/**
 * Terminal teşhis kancaları — normalde tamamen kapalı.
 *
 * Açmak için DevTools konsolunda:
 *   localStorage.agentdeckTermDebug = '1'; location.reload()
 * Kapatmak için:
 *   delete localStorage.agentdeckTermDebug; location.reload()
 */

const FLAG_KEY = 'agentdeckTermDebug'

let cached: boolean | null = null

export function isTermDebug(): boolean {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(FLAG_KEY) === '1'
    } catch {
      // localStorage erişilemezse teşhis kapalıdır.
      cached = false
    }
  }
  return cached
}

/** İzlenen DECSET/DECRST modları — scroll davranışını belirleyenler. */
const WATCHED_MODES: Record<string, string> = {
  '25': 'imleç görünürlüğü',
  '1000': 'mouse tracking (vt200)',
  '1002': 'mouse tracking (drag)',
  '1003': 'mouse tracking (any)',
  '1004': 'focus olayları',
  '1005': 'mouse utf8 kodlama',
  '1006': 'mouse SGR kodlama',
  '1007': 'alternate scroll',
  '1015': 'mouse urxvt kodlama',
  '1047': 'alt buffer',
  '1048': 'imleç kaydet/geri yükle',
  '1049': 'alt buffer + imleç',
  '2004': 'bracketed paste'
}

const DEC_PRIVATE_MODE = /\x1b\[\?([0-9;]+)([hl])/g

/** Dizi chunk sınırında bölünürse kaybolmasın diye taşınan kuyruk. */
const TAIL_LENGTH = 24
const tails = new Map<string, string>()

/**
 * PTY çıktısındaki DEC private mod geçişlerini loglar.
 * Grok'un hangi modları açtığını görmek için.
 */
export function sniffModes(terminalId: string, data: string): void {
  if (!isTermDebug()) {
    return
  }

  const combined = (tails.get(terminalId) ?? '') + data
  tails.set(terminalId, combined.slice(-TAIL_LENGTH))

  DEC_PRIVATE_MODE.lastIndex = 0
  let match = DEC_PRIVATE_MODE.exec(combined)
  while (match !== null) {
    const enabled = match[2] === 'h'
    for (const code of match[1].split(';')) {
      const label = WATCHED_MODES[code]
      if (label !== undefined) {
        // eslint-disable-next-line no-console
        console.log(
          `[term ${terminalId.slice(0, 6)}] ?${code} ${enabled ? 'AÇILDI' : 'kapandı'} — ${label}`
        )
      }
    }
    match = DEC_PRIVATE_MODE.exec(combined)
  }
}

export interface GeometrySnapshot {
  /** fit() sonrası xterm'in satır sayısı */
  fittedRows: number
  /** `_core` düzeltmesi uygulandıysa nihai satır sayısı */
  finalRows: number
  cols: number
  containerHeight: number
  screenHeight: number
  cellHeight: number
}

/**
 * fit() geometrisini loglar. Hipotez: `.xterm-screen` yüksekliği kapsayıcıyı
 * aşıyor ve satır düzeltmesi devreye giriyor; bu da Grok'un yeniden çizim
 * yüksekliğiyle terminalin satır sayısını ayrıştırıp içeriği aşağı yürütüyor.
 */
export function logGeometry(terminalId: string, snapshot: GeometrySnapshot): void {
  if (!isTermDebug()) {
    return
  }

  const corrected = snapshot.finalRows !== snapshot.fittedRows
  const exactRows =
    snapshot.cellHeight > 0 ? snapshot.containerHeight / snapshot.cellHeight : Number.NaN

  // eslint-disable-next-line no-console
  console.log(`[term ${terminalId.slice(0, 6)}] geometri`, {
    cols: snapshot.cols,
    fittedRows: snapshot.fittedRows,
    finalRows: snapshot.finalRows,
    düzeltmeUygulandı: corrected,
    kapsayıcıYükseklik: Math.round(snapshot.containerHeight * 100) / 100,
    ekranYükseklik: Math.round(snapshot.screenHeight * 100) / 100,
    hücreYükseklik: Math.round(snapshot.cellHeight * 100) / 100,
    tamSatırSayısı: Math.round(exactRows * 100) / 100,
    artıkPiksel: Math.round((snapshot.containerHeight % snapshot.cellHeight) * 100) / 100
  })
}

export function resetTermDebugForTests(): void {
  cached = null
  tails.clear()
}
