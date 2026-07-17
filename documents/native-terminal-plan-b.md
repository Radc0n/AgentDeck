# Native terminal (Plan B)

**Tarih:** 2026-07-17  
**Durum:** Uygulandı (B1 — harici OS konsol pencereleri)

## Ne değişti?

AgentDeck artık xterm.js + node-pty ile gömülü emülasyon kullanmıyor. Her terminal:

1. Main süreçte `child_process.spawn` ile **ayrı bir konsol penceresi** açar  
   (Windows 11’de varsayılan terminal genelde Windows Terminal’dir).
2. Uygulama içinde **oturum kartı** gösterir: durum, cwd, “Pencereye git”, “Yeniden aç/başlat”.
3. Seçim / kopyala / yapıştır tamamen **OS terminali** üzerinden çalışır.

## Mimari

| Bileşen | Rol |
|---------|-----|
| `nativeSessionManager.ts` | Spawn, PID takibi, focus (Win32), kill process tree |
| `ipc.ts` | create / kill / focusWindow + attention |
| `TerminalView.tsx` | Native oturum kartı (xterm yok) |

## Dikkat (attention)

PTY çıktı akışı olmadığı için:

- Ajan süreci **kendiliğinden bittiğinde** `needsAttention` + bildirim.
- “Pencereye git” → focus + userInput (dikkat temizlenir).
- Kullanıcı kartı kapatırsa süreç `taskkill /T` ile sonlanır; bilinçli kill’de ajan-exit bildirimi basılmaz.

## Bilinçli kısıtlar

- Uygulama içi ızgarada canlı TTY yok; ızgara orkestrasyon paneli.
- macOS/Linux focus zayıf (PID hayatta mı kontrolü).
- Scrollback AgentDeck’te tutulmaz (OS terminalinde kalır).
