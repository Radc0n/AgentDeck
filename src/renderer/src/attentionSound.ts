let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext()
  return audioContext
}

/** Chromium jest olmadan AudioContext'i askıda bırakır; ilk tık/tuşta aç. */
export function unlockAttentionSound(): void {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
  } catch {
    // Ses yok — sessizce geç.
  }
}

function playTones(ctx: AudioContext): void {
  const start = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(0.18, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45)
  gain.connect(ctx.destination)

  const notes = [523.25, 659.25]
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = notes[i]!
    osc.connect(gain)
    const noteStart = start + i * 0.1
    osc.start(noteStart)
    osc.stop(noteStart + 0.22)
  }
}

/** Ajan dikkat istediğinde kısa, yumuşak iki tonlu bildirim sesi. */
export async function playAttentionSound(): Promise<void> {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    if (ctx.state !== 'running') {
      return
    }

    playTones(ctx)
  } catch {
    // Ses devre dışı veya tarayıcı politikası — sessizce geç.
  }
}
