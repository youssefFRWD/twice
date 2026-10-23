import { useEffect, useState } from 'react'
import App from './App.jsx'
import I18nProvider from './I18nProvider.jsx'
import { PhoneShell } from './PhoneView.jsx'
import { wantsPhoneView } from './viewMode.js'

/** The normal app, or the phone frame when a laptop user has switched to phone view. */
export default function Root() {
  const [phone, setPhone] = useState(wantsPhoneView)
  useEffect(() => {
    const update = () => setPhone(wantsPhoneView())
    window.addEventListener('twice:view', update)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('twice:view', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  if (phone) return <PhoneShell />
  return (
    <I18nProvider>
      <App />
    </I18nProvider>
  )
}
