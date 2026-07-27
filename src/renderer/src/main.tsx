import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Alt küme (latin-*.css) dosyalarında unicode-range YOK; aynı aile/ağırlıkta
// üst üste bindirilirse son bildirim kazanır ve latin-ext (ASCII'de sadece boşluk
// ve 'A' var) tüm yüzü ele geçirir. Toplu 400/500/600 dosyaları unicode-range taşır.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
