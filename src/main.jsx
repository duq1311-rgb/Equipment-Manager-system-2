import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  // If root isn't found, show a small message so it's not a blank page
  document.body.innerHTML = '<div style="padding:20px;font-family:Arial,Helvetica,sans-serif">No #root element found in index.html</div>'
} else {
  createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  )

  if ('serviceWorker' in navigator) {
    const registerSW = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        console.warn('Service worker registration failed')
      })
    }
    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW, { once: true })
    }
  }
}
