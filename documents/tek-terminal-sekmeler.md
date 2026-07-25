# Tek terminal + sekme şeridi

## Karar
Dörtlü grid / odak modu mimarisinden vazgeçildi. Windows Terminal benzeri model:

- Aynı anda **tek** terminal yüzeyi görünür
- Seçili projenin terminalleri **sekmelerle** değişir
- Proje sekmeleri üstte, terminal sekmeleri hemen altında

## Davranış
- `activeTerminalByProjectId`: proje başına son seçili sekme
- Yeni terminal açılınca o sekme aktif olur
- Sekme kapanınca sıradaki (veya önceki) oturuma geçilir
- Aktif projenin tüm xterm örnekleri DOM’da kalır (gizli pane); PTY arka planda yaşar
- Grid / FocusMode UI kaldırıldı (dosyalar ölü kod olabilir)

## UI
- `TerminalWorkspace` + `TerminalTabs`
- `TerminalView` `chrome="bare"`: kart header yok, tam canvas
