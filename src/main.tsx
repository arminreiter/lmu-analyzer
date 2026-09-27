import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OverlayView } from './views/OverlayView'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The desktop overlay window loads the same bundle with ?overlay */}
    {new URLSearchParams(location.search).has('overlay') ? <OverlayView /> : <App />}
  </StrictMode>,
)
