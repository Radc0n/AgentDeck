# Terminal scroll ve içerik kayması

**Tarih:** 2026-07-25
**Durum:** Tekerlek çözüldü · Kayma teşhis aşamasında

## Semptomlar

1. Grok sekmesinde fare tekerleğiyle yukarı scroll **ilk açılışta çalışıyor**, bir süre
   sonra (özellikle proje değiştirip geri dönünce) ölüyor. Windows Terminal'de sorunsuz.
2. ~~Prompt en üstte sabit kalıp mesaj geldikçe aşağı doğru yürüyor.~~
   **Bug değil** — Grok'un kendi özelliğiymiş. Kovalanmadı.

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

## Asıl kök neden — mod pazarlığının replay'de kaybolması

Windows Terminal'de scroll sorunsuz çalışıyor. Yani **Grok SGR mouse tekerlek
raporlarını kendisi işliyor**; terminalin tek işi onları iletmek. AgentDeck'te de ilk
açılışta çalışıyordu. Demek ki sorun statik yapılandırma değil, **zamanla bozulan durum**.

Zincir:

1. `TerminalWorkspace` sadece aktif projenin terminallerini render ediyordu. Başka
   projeye geçince `TerminalView`'lar unmount → `instance.dispose()` → `detachTerminal`.
2. Geri dönünce sıfırdan yeni bir `XTerm` → `attachTerminal` → tampon replay.
3. `ipc.ts` `appendTerminalOutput` bir **halka tampon**: sadece son
   `MAX_TERMINAL_BUFFER_CHARS` (512.000) karakteri tutar, baştan keser.
4. Grok mod pazarlığını (`?1049h`, `?1006h`, `?1002h`) **başlangıçta bir kez** gönderir.
   Her karede kendini çizen bir TUI 512K'yı dakikalar içinde doldurur.
5. O andan sonra replay o dizileri içermez. Yeni xterm `mouseTrackingMode: 'none'` ve
   `buffer.active.type: 'normal'` ile doğar — PTY tarafındaki Grok ise ikisinin de açık
   olduğuna inanmaya devam eder.
6. xterm tekerleği SGR mouse raporu olarak iletmeyi bırakır. Scroll ölür.

### Çözüm

`TerminalWorkspace.tsx` — **tüm projelerin panelleri DOM'da kalır**, sadece görünürlük
değişir. Sekmeler için zaten yapılan şey (`--idle` panelleri canlı tutmak) projelere de
uygulandı. Böylece replay'e hiç ihtiyaç kalmaz; modlar, scrollback, imleç ve renk durumu
korunur.

Yan fayda: gizli projelerin terminalleri artık canlı veri alıyor (`attachedTerminals`
hepsini kapsıyor), tampona bağımlılık ilk mount'a iniyor.

### Kalan açık

Renderer yeniden yüklenirse (`location.reload()`, dev HMR) tüm xterm örnekleri yine
sıfırlanır ve tampon replay edilir. Tampon taşmışsa modlar yine kaybolur. Nadir bir yol
(kullanıcı normalde reload yapmaz) olduğu için şimdilik yapılmadı. Gerekirse çözümü:
main process'te açık DEC private modları takip edip attach'ta replay'in önüne eklemek.

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
