/**
 * PTY ham çıktısında gerçek BEL (0x07) var mı?
 * OSC dizileri (ESC ] ... BEL) başlık/renk ayarı sonlandırıcısıdır; bildirim tetiklemez.
 */
export function containsRealBell(data: string): boolean {
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i)

    if (code === 0x1b && data.charCodeAt(i + 1) === 0x5d) {
      i += 2
      while (i < data.length) {
        const current = data.charCodeAt(i)
        if (current === 0x07) {
          break
        }
        if (current === 0x1b && data.charCodeAt(i + 1) === 0x5c) {
          i += 1
          break
        }
        i++
      }
      continue
    }

    if (code === 0x07) {
      return true
    }
  }

  return false
}

/** Terminale yazılmadan önce gerçek BEL karakterlerini kaldırır (OSC içindekiler korunur). */
export function stripRealBell(data: string): string {
  if (!containsRealBell(data)) {
    return data
  }

  let result = ''
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i)

    if (code === 0x1b && data.charCodeAt(i + 1) === 0x5d) {
      const start = i
      i += 2
      while (i < data.length) {
        const current = data.charCodeAt(i)
        if (current === 0x07) {
          break
        }
        if (current === 0x1b && data.charCodeAt(i + 1) === 0x5c) {
          i += 1
          break
        }
        i++
      }
      result += data.slice(start, i + 1)
      continue
    }

    if (code === 0x07) {
      continue
    }

    result += data[i]
  }

  return result
}
