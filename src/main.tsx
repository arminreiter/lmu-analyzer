import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OverlayView } from './views/OverlayView'
import { isTauri } from '@tauri-apps/api/core'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppCrashed } from './components/AppCrashed'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The desktop overlay window loads the same bundle with ?overlay; in the browser that's just the app */}
    {isTauri() && new URLSearchParams(location.search).has('overlay') ? (
      <ErrorBoundary fallback={<AppCrashed offerClear={false} />}><OverlayView /></ErrorBoundary>
    ) : (
      <ErrorBoundary fallback={<AppCrashed />}><App /></ErrorBoundary>
    )}
  </StrictMode>,
)
