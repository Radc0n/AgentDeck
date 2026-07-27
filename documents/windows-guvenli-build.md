# Windows güvenli release

## İmzalı release

`npm run dist` artık geçerli bir kod imzalama kimliği bulamazsa build'i durdurur. Böylece
yanlışlıkla imzasız installer dağıtılamaz.

PFX tabanlı bir Windows kod imzalama sertifikası kullanırken bilgileri yalnızca o PowerShell
oturumu için ortam değişkeni olarak ver:

```powershell
$env:WIN_CSC_LINK = "C:\guvenli-konum\codesign.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<sertifika-parolasi>"
npm run dist
npm run verify:signature
```

Sertifikayı, parolasını veya base64 içeriğini repoya ekleme.

Azure Trusted Signing kullanılıyorsa electron-builder'ın Azure signing ayarları ayrıca
yapılandırılmalıdır. Sertifika ya da Trusted Signing hesabı projenin içinden üretilemez;
doğrulanmış yayıncı kimliği dışarıdan alınır.

## Yalnızca yerel test

İmzasız installer yalnızca yerel doğrulama için açıkça üretilebilir:

```powershell
npm run dist:unsigned
```

Bu çıktı arkadaşlara veya son kullanıcılara gönderilecek release değildir.
