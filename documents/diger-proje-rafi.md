# Diğer proje rafı

Üst çubuktaki proje sekmelerinin **sağında** (ekle butonunun yanında) sabit **Diğer** butonu vardır.

## Davranış

- Ana çubukta yalnızca `other !== true` projeler görünür.
- Projeyi **Diğer** butonunun üzerine veya çubuğun **en sağına** sürükleyince `other: true` olur (pin kalkar).
- **Diğer** tıklanınca raf paneli açılır; buradan proje seçilebilir.
- Raf listesinde sağ tık yok; her satırda **geri al** (↩) butonu projeyi ana çubuğa taşır.
- Ana çubuk projelerinde sağ tık menüsü: `Diğer'e taşı` vb.
- En az bir terminali olan projeler sarımtırak (`#e8d5a3`), terminalsizler beyaz/nötr.

## Persist

`Project.other` alanı `agentdeck.json` içinde saklanır (`sessionStore` normalize eder).
