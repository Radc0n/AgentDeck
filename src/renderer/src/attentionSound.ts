import attentionWav from './assets/attention.wav?url'

let player: HTMLAudioElement | null = null
let unlocked = false
let playGeneration = 0

function getPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio(attentionWav)
    player.preload = 'auto'
    player.volume = 1
  }
  return player
}

/** İlk tık/tuşta ses öğesini kilitle — sonraki play() jest gerektirmez. */
export function unlockAttentionSound(): void {
  if (unlocked) {
    return
  }

  try {
    const audio = getPlayer()
    const previous = audio.volume
    const generation = playGeneration
    audio.volume = 0.001
    const play = audio.play()
    unlocked = true
    if (play && typeof play.then === 'function') {
      void play
        .then(() => {
          if (generation !== playGeneration) {
            return
          }
          audio.pause()
          audio.currentTime = 0
          audio.volume = previous
        })
        .catch(() => {
          unlocked = false
          audio.volume = previous
        })
    }
  } catch {
    unlocked = false
  }
}

/** Ajan dikkat istediğinde paketlenmiş WAV çalar (Web Audio / toast değil). */
export function playAttentionSound(): void {
  try {
    const audio = getPlayer()
    playGeneration += 1
    audio.volume = 1
    audio.currentTime = 0
    const play = audio.play()
    if (play && typeof play.catch === 'function') {
      void play.catch(() => {
        unlocked = false
        unlockAttentionSound()
      })
    }
  } catch {
    // Ses devre dışı veya tarayıcı politikası — sessizce geç.
  }
}
