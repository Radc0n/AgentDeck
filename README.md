# AgentDeck

Çoklu terminal masaüstü uygulaması. Projeleri sekmelerde tutar, her projede birden fazla
gömülü terminal açar (xterm + node-pty / ConPTY) ve bir terminal ilgi istediğinde haber verir.

Windows x64 için geliştirildi.

## Kurulum

Gereken tek şey Node.js (20 veya üstü; 22.14 ile test edildi). Visual Studio ya da
build tools gerekmez — `node-pty` hazır derlenmiş binary ile gelir.

```powershell
npm install
npm run dist:dir
```

Sonra uygulamayı aç:

```text
dist\win-unpacked\AgentDeck.exe
```

İstersen bu exe'ye masaüstü kısayolu oluştur. Kod değiştikçe `npm run dist:dir` komutunu
tekrar çalıştırman yeterli.

> Uygulamayı kendi makinende derlediğin için Windows SmartScreen uyarısı çıkmaz. Hazır
> indirilen bir installer'da çıkardı — sebebi imza değil, indirilen dosyaya eklenen
> "Mark of the Web" damgası.

## Geliştirme

```powershell
npm run dev        # hot reload ile geliştirme modu
npm run typecheck  # TypeScript kontrolü
npm test           # testler (vitest)
```

## Diğer dokümanlar

- [`documents/setup-ve-guncelleme.md`](documents/setup-ve-guncelleme.md) — installer üretme,
  sürüm artırma, ikon değiştirme, sorun giderme
- [`documents/windows-guvenli-build.md`](documents/windows-guvenli-build.md) — imzalı release
  ve kod imzalama sertifikası
