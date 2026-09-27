import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OverlayView } from './views/OverlayView'
import { isTauri } from '@tauri-apps/api/core'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The desktop overlay window loads the same bundle with ?overlay; in the browser that's just the app */}
    {isTauri() && new URLSearchParams(location.search).has('overlay') ? <OverlayView /> : <App />}
  </StrictMode>,
)
