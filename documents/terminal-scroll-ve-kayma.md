# Terminal scroll ve içerik kayması

**Tarih:** 2026-07-25
**Durum:** Tekerlek çözüldü · Kayma teşhis aşamasında

## Semptomlar

1. Grok sekmesinde fare tekerleğiyle yukarı scroll çalışmıyor. Düz `shell` (PowerShell)
   sekmesinde **çalışıyor**.
2. Prompt en üstte sabit kalıp mesaj geldikçe aşağı doğru yürüyor.

## Kök neden — DÜZELTİLDİ

İlk teşhis yanlıştı. Doğrusu: **Grok alternatif ekran arabelleğinde çalışıyor**
(`CSI ? 1049 h`).

Bu belirleyici. **Alternatif buffer'da terminal scrollback'i tanımı gereği yoktur** —
xterm.js'te de, Windows Terminal'de de, iTerm'de de. Uygulama ekranın tamamına sahiptir
ve geçmişi kendi yönetir. Yani "tekerlekle yukarı çıkma" ancak Grok kendi implemente
ederse olur; terminalin yapabileceği bir şey değildir.

### Yanlış deneme (kayda geçsin, tekrarlanmasın)

Alt buffer'da tekerleği ok tuşuna çevirdik — standart "alternate scroll" davranışı.
**Patladı:** Grok ok tuşlarını mesaj geçmişinde gezinme olarak yorumluyor, tekerlek
konuşma geçmişini karıştırdı. Ink tabanlı TUI'lerde alternate-scroll varsayılamaz.

### Şu anki davranış

`src/renderer/src/terminalWheel.ts` — `attachCustomWheelEventHandler` ile politika katmanı.

| Durum | Sonuç |
|---|---|
| `Shift` basılı | uygulamaya ilet (kaçış kapısı) |
| `mouseTrackingMode === 'none'` | xterm varsayılanı |
| `deltaY === 0` | xterm varsayılanı |
| **Alternatif buffer** | **xterm varsayılanı — asla karışma** |
| Normal buffer + tracking açık | `terminal.scrollLines()` |

Normal buffer dalı, alt buffer kullanmayan TUI'ler için hâlâ geçerli bir iyileştirme.
Grok'u etkilemiyor.

Karar mantığı saf fonksiyon (`decideWheelAction`), `terminalWheel.test.ts` ile test edilir.
`TerminalView.tsx` içinde `instance.open()` sonrası tek satırla bağlanır.

### Açık soru

Grok, Windows Terminal'de tekerlekle kaydırılabiliyor mu? Cevap belirleyici:

- **Evet ise** → Grok SGR mouse raporlarını kendi işliyor. O zaman sorun bizim
  negotiation'ımızda (muhtemelen `?1006` SGR kodlaması) ve düzeltilebilir.
- **Hayır ise** → Grok'un kendi kısıtı, AgentDeck'in değil. Terminal tarafında
  yapılacak bir şey yok; çözüm Grok'un kendi kaydırma tuşları veya AgentDeck
  tarafında ayrı bir transcript yakalama olur.

## Kök neden (2 — hipotez, ölçülüyor)

Hipotez: Grok her karede tüm arayüzünü "imleci yukarı al + sil + yeniden çiz" ile basıyor.
xterm'in satır sayısı Grok'un varsaydığı yükseklikle tutmuyorsa her çizimde artık kalıyor
ve blok aşağı yürüyor.

Şüpheli: `TerminalView.tsx` içindeki `fit()` sonrası satır düzeltmesi. `.xterm-screen`
kapsayıcıyı aşarsa satır sayısı elle azaltılıyor — bu, PTY'ye bildirilen satır sayısı ile
gerçekte çizilebilen satır sayısını ayrıştırabilir.

### Teşhis nasıl açılır

DevTools konsolunda:

```js
localStorage.agentdeckTermDebug = '1'; location.reload()
```

İki tür log akar:

- `[term xxxxxx] ?1002 AÇILDI — mouse tracking (drag)` — Grok'un açtığı DEC private modlar
- `[term xxxxxx] geometri { fittedRows, finalRows, düzeltmeUygulandı, artıkPiksel, ... }`

**Nereye bakmalı:** `düzeltmeUygulandı: true` görülüyorsa ve `artıkPiksel` sıfırdan belirgin
şekilde büyükse hipotez doğrulanmış olur. `tamSatırSayısı` ile `finalRows` arasındaki fark
kaymanın kare başına ne kadar olduğunu verir.

Kapatmak için: `delete localStorage.agentdeckTermDebug; location.reload()`

Teşhis bayrağı kapalıyken sıfır maliyet (`isTermDebug()` tek seferlik okunup önbelleklenir).

## Kapsam dışı bırakılanlar

Bilinçli olarak bu turda yapılmadı — "native his" için sıradaki adaylar:

- WebGL renderer (`@xterm/addon-webgl`) — şu an DOM renderer kullanılıyor
- Sağ tık yapıştır / `Ctrl+Shift+C`-`V`
- `Ctrl+F` arama (`@xterm/addon-search`)
- Link tıklama (`@xterm/addon-web-links`)
- `scrollOnUserInput`, `smoothScrollDuration` seçenekleri

## Geri dönüş noktası

`git tag terminal-scroll-oncesi` (commit `1d9a758`)
