# AgentDeck Kurulum ve Guncelleme Rehberi

Bu rehber AgentDeck'i masaustu uygulamasi olarak kurmak ve projeye yeni feature ekledikten sonra uygulamayi guncellemek icin kullanilir.

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

Production build alir ve Windows installer uretir. Son kullanici gibi acmak istedigin surum icin bu komut kullanilir.

## Sorun Giderme

Installer uretilmezse once su komutlari calistir:

```powershell
npm install
npm run typecheck
npm test
npm run dist
```

Plan B sonrasi terminaller OS konsolunda acilir; `node-pty` / xterm bagimliligi kaldirildi. Genel kurulum hatasi alirsan `node_modules` klasorunu silip yeniden kur:

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

Sonra `dist` klasorundeki installer'i calistir.
