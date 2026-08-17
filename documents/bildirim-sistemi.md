# AgentDeck bildirim sistemi

**Tarih:** 2026-08-17
**Durum:** Çalışır · Windows sesi main process’ten · Grok kancası AgentDeck içinde no-op
**Önem:** Kullanıcı ajan turu bitince ding duymak istiyor; oturum açılışında sessiz kalınacak.

Bu belge bilinçli tasarımı, dosya haritasını ve “tekrarlama / kendi kendine bozulma”
tuzaklarını kaydeder. Bildirim yolunu değiştirmeden önce burayı oku.

## İstenen davranış

| Durum | Rozet / toast | Ses |
|---|---|---|
| Grok (veya diğer ajan) oturumu yeni açıldı | Yok | Yok |
| Kullanıcı sordu, tur bitti, pencere/sekme odakta | Rozet yok | Ding |
| Kullanıcı sordu, tur bitti, başka yere bakıyor | `needsAttention` + (pencere odakta değilse) Windows toast | Ding |
| Grok seçmeli soru kartı (`ask_user_question`) veya onay bekliyor | Odaktaysa rozet yok | Ding |
| Aynı tur için ikinci BEL / ikinci sessizlik | Yok | Yok |
| Düz `shell` terminali BEL gönderdi | Yok | Yok |
| AgentDeck dışındaki normal Grok CLI | AgentDeck karışmaz | Grok kancası çalar |

Toast `silent: true`. Ses toast’a bırakılmaz — paketlemede Start Menu kısayolu
olmayan `win-unpacked` toast’ı sessiz veya yok.

## Neden üç katman var

1. **Grok CLI kancası** (`~/.grok/config.toml`)
   Dışarıdaki Windows Terminal / harici Grok için. ConPTY içinden
   `System.Media.SoundPlayer` ses çıkarmaz; AgentDeck PTY’de kanca no-op.
2. **AgentDeck dikkat makinesi** (`attentionMonitor.ts`)
   BEL / OSC notify ve “3 sn sessizlik” yedeği. Rozet + “bu tur çalındı” kilidi.
3. **Windows main-process sesi** (`attentionSound.ts` → PowerShell)
   Electron renderer `AudioContext` / HTMLAudio paketli uygulamada ve odak
   dışındayken güvenilir değil. Tamamlanma ding’i Windows’ta her zaman buradan.

Çift ötmemek için: PTY ortamında `AGENTDECK=1`. Grok kancası bunu görünce
`exit 0`. Sesi yalnızca madde 3 çalar.

## Akış

```
PTY çıktısı
  → classifyPtyOutput          notify | content | activity | noise
  → stripRealBell              gerçek BEL xterm'e gitmez (OSC sonlandırıcı BEL kalır)
  → notify + ajan profili      applyCliNotify
  → content                    output (busy)
  → activity                   başlık/progress: sessizlik saati yenilenir, tur sayılmaz
  → 400 ms poll                evaluateAttentionTimeout (3 sn sessizlik yedeği)
  → ring?                      playCompletionSound
       win32  → playAttentionSound()   (PowerShell SoundPlayer)
       diğer  → ringTerminal()         (renderer WAV)
  → needsAttention + pencere odakta değil
                               Electron Notification (sessiz toast)
  → renderer                   ATTENTION_CHANGED → sekme/proje rozeti
```

CLI notify gelmezse (Grok odak bilmez, `unfocused` varsayılanı, TERM_PROGRAM
bilinmiyor) 3 sn sessizlik yedeği yine ding üretir.

Seçmeli soru kartı turu **bitirmez** (`turn_complete` yok) ve resmi olay
listesinde de yok. Kart TUI’si sürekli çizildiği için 3 sn yedek de dolmaz.
`classifyPtyOutput` kart chrome’unu (`Type your answer here`, `navigate`+`copy`,
`Always allow on all sessions`) `notify` sayar — BEL olmasa da hemen ding.

Ok / Tab / Esc gezinmedir; `isTurnStartingInput` bunları yeni tur saymaz.
Aynı terminalde 1,5 sn içinde ikinci ses kesilir (j/k ile kartta dolaşırken).

## Dikkat makinesi

Dosya: `src/main/attentionMonitor.ts`

Durumlar: `idle` → `busy` → `needsAttention`.

Önemli bayraklar:

- `hasUserEngaged` — kullanıcı bu oturuma yazdı. Yazılmadan gelen BEL / çıktı yok sayılır
  (oturum-açılış bildirimi buradan kesildi).
- `responseNotified` — bu tur için ses/rozet verildi. Focus veya yeni tur
  başlatan girdi (yazı / Enter / rakam) sıfırlar; ok/Tab sıfırlamaz.
- `lastFocusAt` + `focusCooldownMs` (2,5 sn) — sekmeye dönüşteki TUI yeniden çizimi
  yeni ajan yanıtı sayılmaz.
- `suppressNotify` — bu terminale **ve** pencereye bakıyorsan rozet yok; ses yine çalar
  (`applyCliNotify.ring` veya `isFocusedCompletion`).

Sabitler: `busyTimeoutMs = 3000`, `focusCooldownMs = 2500`.

`isAgentTerminal`: `grok` / `claude` / `cursor` / `codex` / `antigravity` / `custom`.
`shell` hiç bildirim üretmez.

## Grok config (kullanıcı ev dizini)

Dosya: `src/main/grokNotifications.ts`
Hedef: `%USERPROFILE%\.grok\config.toml`

Her Grok PTY spawn’ında `ensureGrokNotificationConfig()` çalışır. Config yoksa
dokunulmaz. Yazılamazsa PTY yine açılır (`try/catch` in `ipc.ts`).

İşaret satırı: `# agentdeck: grok-notify`

Eklenen blok (özet):

```toml
# agentdeck: grok-notify
[ui.notifications]
method = "bel"
condition = "always"
idle_threshold_secs = 0
events = ["turn_complete", "approval_required"]

[[ui.notifications.hooks]]
command = "... powershell ... if ($env:AGENTDECK -eq '1') { exit 0 }; SoundPlayer ..."
events = ["turn_complete", "approval_required"]
only_unfocused = false
timeout_secs = 8
```

`condition = always` zorunlu: Grok, `TERM_PROGRAM=AgentDeck` için odak takibi
yapamaz. Varsayılan `unfocused` AgentDeck içinde hiç `turn_complete` göndermez.

Birleştirme kuralları (`mergeGrokNotificationConfig`):

- İşaret **ve** `$env:AGENTDECK` varsa dosya **aynen** kalır.
- İşaret var, `AGENTDECK` yoksa işaretten **dosya sonuna kadar** yeni blokla değişir.
- İşaret yoksa blok dosya sonuna eklenir.
- `session_ready` **eklenmez** (açılır açılmaz ding).

### Bu birleştirmenin kırılganlığı

Gerçek TOML parser değil. İşaretten sonraki her şey, kanca güncellenirken silinir.
Grok veya kullanıcı işaretten sonra yeni bölüm yazarsa ve `AGENTDECK` satırı
kaybolursa o kuyruk gider. İki `[ui.notifications]` tablosu da Grok parser’ına
göre last-win veya hata olabilir.

Kullanıcı kendi bildirim ayarını buraya koyacaksa işareti ve `AGENTDECK`
satırını silmeden **öncesine** yazsın; ya da birleştirmeyi gerçek TOML’a taşı.

## Ses

### Windows (asıl yol)

`src/main/attentionSound.ts` → `powershell.exe -WindowStyle Hidden` →
`System.Media.SoundPlayer` + `PlaySync()`.

WAV adayları sırayla:

1. `Windows Notify System Generic.wav`
2. `Windows Notify.wav`
3. `Windows Background.wav`
4. `notify.wav`

Hiçbiri yoksa `[System.Media.SystemSounds]::Asterisk`. Spawn hatası yutulur;
uygulama düşmez. `PlaySync` çocuk süreçte; Electron’u bloklamaz.

`playCompletionSound` Windows’ta `ringTerminal` çağırmaz. Renderer WAV
Windows tamamlanma yolunda kullanılmaz.

### Renderer WAV (macOS/Linux veya `TERMINAL_BELL`)

`src/renderer/src/attentionSound.ts` + `assets/attention.wav`.
İlk tık/tuş `unlockAttentionSound` (autoplay kilidi).
`useTerminalIO` `onTerminalBell` gelirse çalar.

Pencere: `autoplayPolicy: 'no-user-gesture-required'`,
`backgroundThrottling: false`. CSP `media-src 'self'`.
`agentdeck://` protokolü `.wav` için `Content-Type: audio/wav` verir.

## Ortam

`src/main/terminalEnv.ts`:

- `TERM_PROGRAM=AgentDeck`
- `AGENTDECK=1`
- `AGENTDECK_TERMINAL_ID=<id>` (`ptyManager` ekler)

Kanca `AGENTDECK` ile no-op olur. Bu değişken kalkarsa dış kanca da çalar → **çift ding**.

## Dosya haritası

| Dosya | İş |
|---|---|
| `src/main/attentionMonitor.ts` | FSM, CLI notify, odak tamamlanma |
| `src/main/attentionMonitor.test.ts` | FSM sözleşmesi |
| `src/main/ptyOutput.ts` | BEL / OSC 9 / 99 / 777; başlık-progress activity |
| `src/main/bellDetect.ts` | `stripRealBell` — gerçek BEL xterm’e gitmez |
| `src/main/attentionSound.ts` | Windows PowerShell ding |
| `src/main/grokNotifications.ts` | `config.toml` birleştirme |
| `src/main/ipc.ts` | poll, toast, `playCompletionSound`, grok spawn hook |
| `src/main/terminalEnv.ts` | `AGENTDECK=1` |
| `src/main/index.ts` | AppUserModelId, wav MIME, autoplay, throttle |
| `src/renderer/src/hooks/useAttentionSync.ts` | rozet store + ses unlock |
| `src/renderer/src/hooks/useTerminalIO.ts` | focus/input/bell IPC |
| `src/renderer/src/projectAttention.ts` | proje sekmesinde unread noktası |
| `src/renderer/src/attentionSound.ts` | renderer WAV |
| `src/shared/ipc.ts` | `TERMINAL_BELL`, `ATTENTION_CHANGED`, dismiss/reset |

Test: `npx vitest run` — attention / grokNotifications / attentionSound / ptyOutput
paketleri yeşil kalmalı.

## Bilinçli tuzaklar (tekrarlama)

1. **Grok kancasının AgentDeck içinde çalacağını varsayma.** ConPTY’de
   SoundPlayer sessiz. Ses main process’te.
2. **`condition = unfocused` geri koyma.** AgentDeck bilinmeyen terminal;
   turn_complete hiç gelmez.
3. **`session_ready` ekleme.** Açılır açılmaz gereksiz ding.
4. **Kullanıcı yazmadan BEL’i notify sayma.** Oturum banner / TUI çizimi
   sahte bildirim üretir.
4b. **Seçmeli kartı “tur bitti” sanma.** Tur devam eder; ding `looksLikeBlockingPrompt`
   ile gelir. Grok’a `ask_user_question` olayı eklenirse bu eşleşmeyi sadeleştir.
5. **Odaklı sekmede sesi de kesme.** Rozet yok, ding var — bu ürün kararı.
6. **Toast’a ses bırakma.** `silent: true` kalsın.
7. **Main/preload değişince `npm run dev` tam kapatılıp açılsın.** HMR main’i
   yenilemez; eski süreç eski ses yolunu çalar.
8. **Yeni Grok sekmesi aç.** Eski PTY eski env / eski hook ile doğmuş olabilir.
9. **`useConptyDll` bildirim değil, paketleme düzeltmesi.** Paketli Electron’da
   node-pty `process.execPath` ile kill forklayınca ikinci AgentDeck penceresi
   açılıyordu. Bildirimle karıştırma.

## İleride bozulursa bakılacak yer

| Semptom | İlk bakış |
|---|---|
| Dış Grok öter, AgentDeck sessiz | `npm run dev` tam restart? Yeni grok sekmesi? `playAttentionSound` spawn? |
| AgentDeck + dış Grok çift öter | `AGENTDECK=1` PTY’de mi? Hook hâlâ `exit 0` mu? |
| Açılır açılmaz ding | `session_ready` config’e mi girdi? `hasUserEngaged` atlandı mı? |
| Tur ortasında erken ding | 3 sn sessizlik; ajan düşünürken token yok |
| Config bozuldu | `~/.grok/config.toml` işaret / çift tablo / kuyruk silindi |
| Rozet yanıyor ses yok | Windows PowerShell yolu / WAV yok; spawn error yutuluyor |
| Ses var rozet yok, bakıyorsun | Beklenen (`suppressNotify`) |

## Kasıtlı olarak yapılmayanlar

- Claude / Codex / Cursor için benzer CLI config yazımı yok (onların kendi
  notify’si + 3 sn yedek).
- `config.toml` gerçek TOML merge değil.
- Bildirimler henüz commit/PR değil (clipboard PR ayrı, merge edildi).

Bu sistemi “CLI kendi çalsın, AgentDeck karışmasın” diye sadeleştirmek Windows
ConPTY’de sessizliğe döner. Tersi — yalnızca Grok kancası, main sessiz — aynı.
İki tarafın işbölümü bilinçli.
