import { useEffect, useState } from 'react'
import { inFrame, setPhoneView } from './viewMode.js'

/* Phone view for laptops: the same app, shown inside a phone-sized frame.
   The frame is an iframe of the app itself, so the real phone layout (bottom tabs, bottom sheet…) applies. */

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </svg>
)

/** The header button. Hidden on phones and inside the phone frame. */
export function ViewSwitch() {
  if (inFrame) return null
  return (
    <button className="btn small view-switch" onClick={() => setPhoneView(true)} title="See how twice looks on a phone">
      <PhoneIcon />Phone view
    </button>
  )
}

const SIZES = [
  { id: 'std', label: 'Phone', w: 390, h: 844 },
  { id: 'small', label: 'Small phone', w: 360, h: 640 },
]

export function PhoneShell() {
  const [size, setSize] = useState(SIZES[0])
  useEffect(() => {
    const prev = document.title
    document.title = 'twice · phone view'
    return () => {
      document.title = prev
    }
  }, [])
  const src = `${location.pathname}?embedded=1${location.hash}`
  return (
    <div className="phone-shell">
      <div className="ps-bar">
        <button className="btn small" onClick={() => setPhoneView(false)}>
          ← Back to desktop view
        </button>
        <div className="seg ps-sizes" role="group" aria-label="Phone size">
          {SIZES.map(s => (
            <button key={s.id} aria-pressed={size.id === s.id} onClick={() => setSize(s)}>
              <span className="l">{s.label}</span>
              <span className="mono ps-dim">{s.w} × {s.h}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ps-device" style={{ width: size.w + 20, height: `min(${size.h + 20}px, calc(100dvh - 96px))` }}>
        <iframe className="ps-screen" title="twice on a phone" src={src} allow="geolocation" />
      </div>
    </div>
  )
}
