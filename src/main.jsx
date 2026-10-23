import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import { initialPrefs, loadDict } from './i18n.js'

/* Draw the page once the web font and the language file are in, so the headline and buttons don't jump when they arrive.
   If either is slow or blocked, give up after a moment and show the page anyway. */
const fontsReady = Promise.race([
  Promise.all([
    loadDict(initialPrefs().lang),
    ...['500', '700', '800'].map(w => document.fonts.load(`${w} 1em "Schibsted Grotesk"`)),
  ]),
  new Promise(r => setTimeout(r, 1500)),
]).catch(() => {})

fontsReady.then(() =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  ),
)
