# Terminal scroll ve içerik kayması

**Tarih:** 2026-07-25
**Durum:** Tekerlek çözüldü · Kayma teşhis aşamasında

## Semptomlar

1. Grok sekmesinde fare tekerleğiyle yukarı scroll çalışmıyor. Düz `shell` (PowerShell)
   sekmesinde **çalışıyor**.
2. Prompt en üstte sabit kalıp mesaj geldikçe aşağı doğru yürüyor.

## Kök neden (1 — doğrulandı)

Grok gibi Ink tabanlı TUI'ler mouse-tracking modunu açar (`CSI ? 1000/1002/1003 h`).
xterm.js varsayılanı bu moddayken tekerleği viewport kaydırmak yerine escape dizisi
olarak uygulamaya iletir. Grok bunu işlemediği için hiçbir şey olmaz.

Windows Terminal / iTerm davranışı farklıdır: **normal buffer'da scrollback terminalindir**,
mouse tracking ne derse desin.

### Çözüm

`src/renderer/src/terminalWheel.ts` — `attachCustomWheelEventHandler` ile politika katmanı.

| Durum | Sonuç |
|---|---|
| `Shift` basılı | uygulamaya ilet (kaçış kapısı) |
| `mouseTrackingMode === 'none'` | xterm varsayılanı |
| `deltaY === 0` | xterm varsayılanı |
| Normal buffer + tracking açık | `terminal.scrollLines()` — **asıl düzeltme** |
| Alternatif buffer + tracking açık | ok tuşuna çevir (DECCKM'ye göre `CSI` / `SS3`) |

Karar mantığı saf fonksiyon (`decideWheelAction`), `terminalWheel.test.ts` ile test edilir.
`TerminalView.tsx` içinde `instance.open()` sonrası tek satırla bağlanır.

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
