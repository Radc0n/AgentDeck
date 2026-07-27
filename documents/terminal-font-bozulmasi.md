# Terminal render bozulması — CSP xterm'in stilini blokluyordu

**Tarih:** 2026-07-27
**Durum:** Çözüldü

## Semptom

Terminal içeriği bozuk çiziliyordu: TUI kutu kenarları (`│`) metne yapışıyor, hiçbir
sütun hizalanmıyordu. Claude Code / Grok gibi kutu çizen her TUI'de görünüyordu.
`6a97776` (güvenlik sertleştirmesi) öncesinde sorun yoktu.

## Kök neden

`6a97776` `index.html`'e CSP ekledi: `style-src 'self'`.

xterm.js'in DOM renderer'ı, hücre ızgarasının `font-family` / `font-size` /
hücre boyutu kurallarını **çalışma anında `<style>` etiketi enjekte ederek** verir.
`style-src 'self'` inline stylesheet'e izin vermez → etiketler DOM'da durur ama
`sheet` değeri `null`, yani hiç uygulanmaz.

Sonuç: `.xterm-rows` gövdeden **`Inter … sans-serif` 14px** miras alıyordu. Terminalde
orantılı font. Canlı pencerede CDP ile ölçülen ilerleme genişlikleri:

| karakter | bozukken | düzeldikten sonra |
|---|---|---|
| boşluk | 3.94px | 7.800px |
| `a` | 7.86px | 7.800px |
| `W` | — | 7.800px |
| `│` | 8.75px | 7.617px |
| `─` | 9.92px | 7.617px |

Dolgu boşlukları yarı genişlikte çizildiği için sağ kenar `│` metne yapışıyordu.

Aynı CSP dev modda **tüm** CSS'i öldürüyordu (Vite dev CSS'i de `<style>` enjekte eder) —
uygulama stilsiz HTML olarak açılıyordu. Tek kök neden, iki semptom.

## Çözüm

`src/renderer/index.html` — `style-src 'self' 'unsafe-inline'`.
(Gereksiz kalan `style-src-attr 'unsafe-inline'` kaldırıldı.)

xterm.js CSP altında `style-src 'unsafe-inline'` gerektirir; nonce/hash uygulanamaz
çünkü stiller dinamik ve JS tarafından üretiliyor.

## Yanlış teşhis (kayda geçsin)

İlk teşhis "fontsource alt küme çakışması" idi — **yanlıştı**, test edilmeden iddia
edildi. Ama yol üstünde gerçek bir gizli hata bulundu ve düzeltildi:

`main.tsx` `@fontsource/*/latin-400.css` + `latin-ext-400.css` gibi **alt küme**
dosyalarını birlikte import ediyordu. Bu dosyalarda `unicode-range` yoktur; aynı
aile/ağırlık/stil ile üst üste bindirilince **son bildirim öncekini ezer** ve
`latin-ext` yüzü kazanır. O yüzün ASCII kapsaması ölçüldü: sadece `' '` ve `'A'`.

Düzeltme: toplu `400/500/600.css` dosyaları (unicode-range taşırlar).
Doğrulama: built CSS'te `unicode-range` sayısı 0 → 39.

**Kural:** `@fontsource`'tan asla birden fazla `<subset>-<weight>.css` import etme.

## Kalan bilinen sapma

Kutu çizim karakterleri (U+2500+) JetBrains Mono web font alt kümelerinde yok;
Cascadia Code'a fallback ediyor. 7.617px vs 7.800px → uzun yatay çizgilerde ~80
karakterde ~2 hücre kayma. `6a97776` öncesinde de böyleydi (Google Fonts aynı alt
kümeleri servis ediyordu), yani regresyon değil. Tamamen gidermek isterse:
terminal font yığınında Cascadia Code'u başa almak veya tam JetBrains Mono TTF'ini
paketlemek.

## Teşhis tekniği

Çalışan Electron penceresine CDP ile bağlanıp ölçmek:

```bash
npx electron . --remote-debugging-port=9222
# http://127.0.0.1:9222/json → page hedefi → webSocketDebuggerUrl
# Node 22'de global WebSocket var; Runtime.evaluate ile getComputedStyle /
# canvas measureText çalıştır.
```

Bloklanan stil kolay yakalanır: `[...document.querySelectorAll('style')]` içinde
`sheet === null` olan varsa CSP onu reddetmiştir.
