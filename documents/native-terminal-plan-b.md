# Terminal mimarisi notu

**Tarih:** 2026-07-17  
**Durum:** Plan B iptal · **Plan C aktif** (gömülü xterm + node-pty / ConPTY)

## Plan B (iptal)

Harici OS konsol pencereleri (Windows Terminal kartları + “Pencereye git”) denendi.

- Focus/HWND kırılgan (WT altında shell `MainWindowHandle=0`)
- Tek pencere / ızgara UX bozuldu
- Görsel bütünlük zayıf

## Plan C (aktif)

Orijinal tasarıma dönüş: **tek AgentDeck penceresi** içinde:

| Katman | Teknoloji |
|--------|-----------|
| Renderer | `@xterm/xterm` + `@xterm/addon-fit` |
| Main | `node-pty` (Windows’ta **ConPTY**) |
| IPC | create / write / resize / kill / attach / data / exit |

Claude, Codex, Grok vb. TUI’ler gerçek PTY + xterm emülasyonu ile çalışır (VS Code modeli).

### Kritik noktalar

1. `useConpty: true` (win32)
2. Fit → `resize` IPC (grid / focus / DPI)
3. Attach buffer: fit sonrası scrollback yaz (TUI bozulmasın)
4. Attention: PTY çıktısı + bell (ajan profilleri)

### Bilinçli trade-off

Windows Terminal’in piksel-perfect skin/eklentileri yok; işlev ve tek-pencere orkestrasyon var.
