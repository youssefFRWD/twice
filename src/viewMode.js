/* Phone view for laptops: remembers the choice and tells the app which view to show. */
const KEY = 'twice:view'
export const PHONE_MIN_WIDTH = 900 // below this the app already uses its phone layout

export const inFrame = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

/** True inside the phone frame: the app was already open, so it skips the landing page. */
export const embedded = new URLSearchParams(location.search).has('embedded')
if (embedded) document.documentElement.classList.add('embedded')

const read = () => {
  try {
    return localStorage.getItem(KEY) === 'phone'
  } catch {
    return false
  }
}

/** True when the phone frame should be shown instead of the normal app. */
export const wantsPhoneView = () => !inFrame && read() && innerWidth >= PHONE_MIN_WIDTH

export function setPhoneView(on) {
  try {
    localStorage.setItem(KEY, on ? 'phone' : 'desktop')
  } catch {
    /* storage blocked: the switch just lasts until reload */
  }
  window.dispatchEvent(new Event('twice:view'))
}
