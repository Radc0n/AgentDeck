# AgentDeck Kurulum ve Guncelleme Rehberi

Bu rehber AgentDeck'i masaustu uygulamasi olarak kurmak ve projeye yeni feature ekledikten sonra uygulamayi guncellemek icin kullanilir.

## Uygulama Ikonu

Kaynak logo: `build/icon-source.png` (orijinal).
Kare PNG: `build/icon.png` (1024x1024, ortadan kirpilmis).
Windows ICO: `build/icon.ico` (exe, kisayol, installer).

Yeni logo icin: kare PNG'yi `build/icon.png` olarak koy, sonra:

```powershell
node -e "require('png-to-ico').default('build/icon.png').then(b=>require('fs').writeFileSync('build/icon.ico', b))"
npm run dist
```

`png-to-ico` yoksa: `npm install --no-save png-to-ico`

## Ilk Kurulum

1. Proje klasorunde terminal ac:

   ```powershell
   cd C:\myPrograms\script\AgentDeck
   ```

2. Bagimliliklar eksikse yukle:

   ```powershell
   npm install
   ```

3. Installer dosyasini uret:

   ```powershell
   npm run dist
   ```

4. Uretilen installer'i calistir:

   ```text
   C:\myPrograms\script\AgentDeck\dist\AgentDeck-Setup-0.1.0.exe
   ```

5. Kurulum tamamlandiktan sonra uygulamayi masaustundeki `AgentDeck` kisayolundan veya Baslat menusunden acabilirsin.

Kurulum sonrasi uygulama su dizine kurulur:

```text
C:\Users\savas\AppData\Local\Programs\AgentDeck\AgentDeck.exe
```

## Feature Ekledikten Sonra Guncelleme

Kodda yeni feature, bug fix veya tasarim degisikligi yaptiktan sonra yeni surumu paketlemek icin:

1. Degisiklikleri kontrol et:

   ```powershell
   git status
   ```

2. TypeScript kontrolunu calistir:

   ```powershell
   npm run typecheck
   ```

3. Testleri calistir:

   ```powershell
   npm test
   ```

4. Yeni installer uret:

   ```powershell
   npm run dist
   ```

5. `dist` klasorundeki yeni installer'i calistir:

   ```text
   C:\myPrograms\script\AgentDeck\dist\AgentDeck-Setup-0.1.0.exe
   ```

Installer eski kurulumun ustune yeni dosyalari yazar. Bu yuzden normalde once eski surumu kaldirmana gerek yoktur.

## Surum Numarasini Artirma

Ayni installer adinin surekli uzerine yazilmasini istemiyorsan `package.json` icindeki `version` alanini artir:

```json
{
  "version": "0.1.1"
}
```

Sonra tekrar calistir:

```powershell
npm run dist
```

Bu durumda yeni dosya ornegin soyle olur:

```text
dist\AgentDeck-Setup-0.1.1.exe
```

Onerilen pratik:

- Kucuk fix icin patch artir: `0.1.0` -> `0.1.1`
- Yeni feature icin minor artir: `0.1.0` -> `0.2.0`
- Buyuk kirici degisiklik icin major artir: `0.1.0` -> `1.0.0`

## Hangi Komut Ne Ise Yarar

```powershell
npm run dev
```

Gelistirme modunda acar. Kod yazarken hizli test icin kullanilir.

```powershell
npm run build
```

Sadece production build alir. Installer uretmez.

```powershell
npm run dist
```

Production build alir ve Windows installer uretir. Yaninda `dist\win-unpacked\` klasorunu da gunceller. Son kullanici gibi acmak istedigin surum icin bu komut kullanilir.

```powershell
npm run dist:dir
```

Installer olmadan sadece `dist\win-unpacked\` uretir (daha hizli). Kurulum istemeden uygulamayi calistirmak icin:

```text
C:\myPrograms\script\AgentDeck\dist\win-unpacked\AgentDeck.exe
```

## Sorun Giderme

Installer uretilmezse once su komutlari calistir:

```powershell
npm install
npm run typecheck
npm test
npm run dist
```

Plan C: terminaller uygulamada gomulu (xterm + node-pty / ConPTY). Genel kurulum hatasi alirsan `node_modules` klasorunu silip yeniden kur:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run dist
```

Uygulama acilmiyorsa once kurulu exe'yi dogrudan calistir:

```text
C:\Users\savas\AppData\Local\Programs\AgentDeck\AgentDeck.exe
```

Masaustu kisayolu gorunmuyorsa Windows bu bilgisayarda OneDrive masaustu kullaniyor olabilir. Bu kurulumda kisayol su konumda olustu:

```text
C:\Users\savas\OneDrive\Masaüstü\AgentDeck.lnk
```

## Installer Kurmadan Calistirma (win-unpacked)

Kurulum sihirbazini istemiyorsan dogrudan unpacked exe yeterlidir:

1. Paketi guncelle:

   ```powershell
   npm run dist:dir
   ```

   veya tam paket (installer + unpacked):

   ```powershell
   npm run dist
   ```

2. Uygulamayi ac:

   ```text
   C:\myPrograms\script\AgentDeck\dist\win-unpacked\AgentDeck.exe
   ```

Istersen bu exe'ye masaustu kisayolu olusturabilirsin. Kod degistikce ayni komutu tekrar calistirip exe'yi yeniden uretmen yeterli.

## Kisa Akis

Gelistirirken:

```powershell
npm run dev
```

Yayinlanacak masaustu surumu hazirlarken:

```powershell
npm run typecheck
npm test
npm run dist
```

Sonra ya `dist\AgentDeck-Setup-0.1.0.exe` installer'ini calistir, ya da `dist\win-unpacked\AgentDeck.exe` ile dogrudan ac.
