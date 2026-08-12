import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import './styles/tokens.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter (not BrowserRouter) because GitHub Pages is static
        hosting with no server-side rewrite rules — a hard refresh on
        /read would 404 with BrowserRouter. Hash-based routes
        (/#/read) always resolve to index.html first. Worth swapping
        back to BrowserRouter if this ever moves to a host that
        supports SPA rewrites (Netlify, Vercel, etc). */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
