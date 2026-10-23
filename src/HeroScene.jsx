import { useEffect, useMemo, useRef, useState } from 'react'
import { ITEMS } from './data.js'
import { useI18n } from './i18n.js'
import { itemById, reducedMotion } from './lib.js'
import { Art, Icon, LineBadge } from './ui.jsx'

/* The landing hero: one continuous scene. A character swipes through listings, saves one, then walks
   to the métro, rides to the next stop and picks it up. Everything is drawn at a fixed 960 x 560 and
   scaled to fit. One clock drives the whole scene, so every layer stays in sync. */

const W = 960
const H = 560
const T = 25.4
const ACTS = [
  { id: 'swipe', at: 0, end: 6.5, still: 4.8 },
  { id: 'save', at: 6.5, end: 12.5, still: 9.9 },
  { id: 'metro', at: 12.5, end: T, still: 23.6 },
]

/* world geometry */
const GY = 400 // street surface
const PF = 720 // métro floor
const CARD_X = 600
const CARD_Y = 255
const PANEL = { x: 760, y: 70 }
const TRAIN_W = 520
const DOOR = 130 // door centre, from the train centre

const stepY = u => {
  const i = Math.floor(u)
  const k = clamp((u - i - 0.5) / 0.5, 0, 1)
  return GY + 32 * (i + k * k * (3 - 2 * k))
}
const groundY = x => {
  if (x <= 860) return GY
  if (x < 1160) return stepY((x - 860) / 30)
  if (x <= 2640) return PF
  if (x < 2940) return stepY((2940 - x) / 30)
  return GY
}

/* tiny timeline helpers */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k
const E = {
  lin: k => k,
  io: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  back: k => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2),
}
const seg = (t, a, b, e = 'io') => E[e](clamp((t - a) / (b - a), 0, 1))
const pulse = (t, a, b) => Math.sin(clamp((t - a) / (b - a), 0, 1) * Math.PI)
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i]
    const [t1, v1, e] = keys[i + 1]
    if (t < t1) return lerp(v0, v1, E[e || 'io']((t - t0) / (t1 - t0)))
  }
  return keys[keys.length - 1][1]
}

/* the story, as keyframes: [time, value, easing] */
const WALK_X = [
  [0, 300], [12.5, 300], [12.9, 350, 'in'], [14.1, 860, 'lin'], [15.4, 1160, 'lin'], [16.2, 1430, 'out'], [16.55, 1430],
  [19.4, 2170], [19.8, 2220, 'in'], [20.7, 2640, 'lin'], [21.9, 2940, 'lin'], [22.9, 3330, 'out'],
]
const TRAIN_X = [[13.9, 100], [15.6, 1560, 'out'], [17.2, 1560, 'lin'], [19.2, 2300, 'io']]
const DOORS_A = [[15.6, 0], [16.1, 1, 'out'], [16.8, 1, 'lin'], [17.2, 0, 'in']]
const DOORS_B = [[19.2, 0], [19.65, 1, 'out']]
const CAM_X = [[0, 480], [6, 480, 'lin'], [7.4, 560], [11.5, 560, 'lin'], [12.5, 480]]
const CAM_Y = [[0, 300], [13.8, 300, 'lin'], [15.3, 560], [20.5, 560, 'lin'], [21.9, 300]]
const ZOOM = [[0, 1], [6.4, 1, 'lin'], [7.6, 1.12], [11.4, 1.12, 'lin'], [12.4, 1]]
const RIDE = [16.55, 19.4]

const pick = id => itemById(id) || ITEMS[id % ITEMS.length]
const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

/* ------------------------------------------------------------------ backdrops */

function Skyline() {
  const els = useMemo(() => {
    const r = rng(7)
    const out = []
    let x = -420
    let i = 0
    while (x < 1340) {
      const w = 46 + Math.floor(r() * 54)
      const h = 50 + Math.floor(r() * 80)
      out.push(
        <g key={i} fill={i % 2 ? '#C5CCC0' : '#BDC6BC'}>
          <rect x={x} y={225 - h} width={w} height={h + 40} />
          <path d={`M${x - 3} ${225 - h}l${w / 2 + 3} -16l${w / 2 + 3} 16z`} fill="#A9B4AA" />
          {r() > 0.5 && <rect x={x + w * 0.2} y={225 - h - 30} width="6" height="22" fill="#B3BDB2" />}
        </g>,
      )
      x += w + 2
      i++
    }
    return out
  }, [])
  return (
    <svg className="hs-svg" style={{ left: -420, top: -60 }} width="1760" height="320" viewBox="-420 -60 1760 320" aria-hidden="true">
      {els}
      {/* the tower */}
      <g transform="translate(560 225)" fill="#A3AFA6">
        <path d="M-34 0L-10 -150 -6 -190 -2 -250 2 -250 6 -190 10 -150 34 0 24 0 8 -120 -8 -120 -24 0z" />
        <rect x="-16" y="-128" width="32" height="7" />
        <rect x="-26" y="-60" width="52" height="7" />
      </g>
    </svg>
  )
}

function Facades() {
  const els = useMemo(() => {
    const r = rng(21)
    const stone = ['#EADFC6', '#E0D3B6', '#EFE6D2', '#DDD0B2', '#E6D9BD']
    const out = []
    let x = -280
    let i = 0
    const base = 335
    while (x < 2260) {
      const w = 150 + Math.floor(r() * 90)
      const floors = 4 + Math.floor(r() * 2)
      const h = floors * 48 + 56
      const top = base - h
      const c = stone[i % stone.length]
      const wins = []
      for (let f = 0; f < floors; f++) {
        const y = top + 10 + f * 48
        for (let k = 0; k < 3; k++) {
          const wx = x + 22 + k * ((w - 60) / 2)
          wins.push(<rect key={`${f}-${k}`} x={wx} y={y + 6} width="22" height="30" rx="2" fill="#7D8C86" opacity=".85" />)
        }
        if (f % 2 === 0) wins.push(<rect key={`b${f}`} x={x + 12} y={y + 36} width={w - 24} height="3" fill="#4C5A55" opacity=".7" />)
      }
      out.push(
        <g key={i}>
          <rect x={x} y={top} width={w} height={h + 20} fill={c} />
          <rect x={x + w - 14} y={top} width="14" height={h + 20} fill="#000" opacity=".07" />
          <path d={`M${x - 4} ${top}L${x + 14} ${top - 34}H${x + w - 14}L${x + w + 4} ${top}z`} fill="#58665F" />
          <rect x={x + w * 0.3} y={top - 56} width="9" height="26" fill="#6F7C75" />
          <rect x={x + w * 0.62} y={top - 46} width="9" height="20" fill="#6F7C75" />
          {wins}
          <rect x={x} y={base - 46} width={w} height="46" fill="#3C5248" opacity=".9" />
          <rect x={x + 12} y={base - 40} width={w - 24} height="26" rx="2" fill="#EFE6D2" opacity=".5" />
          {i % 2 === 0 && <path d={`M${x + 8} ${base - 44}h${w - 16}l-6 10h-${w - 28}z`} fill={i % 4 === 0 ? '#A14947' : '#1F4D3A'} />}
        </g>,
      )
      x += w + 6
      i++
    }
    return out
  }, [])
  return (
    <svg className="hs-svg" style={{ left: -280, top: 0 }} width="2540" height="345" viewBox="-280 0 2540 345" aria-hidden="true">
      {els}
    </svg>
  )
}

function Foreground() {
  return (
    <svg className="hs-svg hs-fore-svg" style={{ left: 100, top: 40 }} width="5200" height="400" viewBox="100 40 5200 400" aria-hidden="true">
      {[300, 4350].map(x => (
        <g key={x} transform={`translate(${x} 420)`}>
          <rect x="-4" y="-250" width="8" height="250" fill="#1E2A24" />
          <rect x="-12" y="-6" width="24" height="6" fill="#1E2A24" />
          <path d="M0 -250q22 -2 30 14" fill="none" stroke="#1E2A24" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="34" cy="-232" rx="15" ry="7" fill="#FFF3C4" />
          <ellipse cx="34" cy="-232" rx="38" ry="22" fill="#FFF3C4" opacity=".16" />
        </g>
      ))}
    </svg>
  )
}

function Tree({ x, s = 1 }) {
  return (
    <g transform={`translate(${x} ${GY}) scale(${s})`}>
      <rect x="-5" y="-92" width="10" height="92" rx="4" fill="#6B4E3A" />
      <circle cx="0" cy="-124" r="44" fill="#3E7A52" />
      <circle cx="-30" cy="-100" r="30" fill="#4A8C5E" />
      <circle cx="30" cy="-102" r="32" fill="#35704A" />
      <circle cx="-8" cy="-146" r="26" fill="#5BA070" opacity=".85" />
      <ellipse cx="0" cy="0" rx="40" ry="6" fill="#000" opacity=".1" />
    </g>
  )
}

function Street() {
  return (
    <svg className="hs-svg" style={{ left: -200, top: 0 }} width="4100" height="420" viewBox="-200 0 4100 420" aria-hidden="true">
      <Tree x={120} s={1.1} />
      <Tree x={770} s={0.85} />
      <Tree x={3050} s={1} />
      <Tree x={3820} s={1.1} />
      {/* café table */}
      <g transform={`translate(520 ${GY})`}>
        <ellipse cx="0" cy="0" rx="50" ry="5" fill="#000" opacity=".1" />
        <rect x="-3" y="-58" width="6" height="58" fill="#3C5248" />
        <ellipse cx="0" cy="-60" rx="34" ry="7" fill="#EFE6D2" stroke="#3C5248" strokeWidth="3" />
        <path d="M-54 0v-28h18v28M36 0v-28h18v28" fill="none" stroke="#A14947" strokeWidth="5" strokeLinecap="round" />
        <path d="M-58 -30h26M32 -30h26" stroke="#A14947" strokeWidth="6" strokeLinecap="round" />
      </g>
      {/* benches */}
      {[690, 3200].map(x => (
        <g key={x} transform={`translate(${x} ${GY})`}>
          <rect x="-44" y="-30" width="88" height="8" rx="3" fill="#8A6A4D" />
          <rect x="-44" y="-52" width="88" height="7" rx="3" fill="#8A6A4D" />
          <rect x="-38" y="-22" width="6" height="22" fill="#3C5248" />
          <rect x="32" y="-22" width="6" height="22" fill="#3C5248" />
        </g>
      ))}
      {/* métro entrance */}
      <g transform={`translate(0 ${GY})`}>
        <path d="M866 0V-96Q866 -150 930 -156Q994 -150 994 -96V0" fill="none" stroke="#2F6B4F" strokeWidth="9" strokeLinecap="round" />
        <path d="M878 0V-92Q878 -138 930 -144Q982 -138 982 -92V0" fill="none" stroke="#2F6B4F" strokeWidth="3" opacity=".7" />
        <rect x="882" y="-150" width="96" height="22" rx="4" fill="#2F6B4F" />
        <text x="930" y="-134" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="11.5" letterSpacing="1.4" fill="#F6F1E7">MÉTROPOLITAIN</text>
        <circle cx="866" cy="-104" r="11" fill="#FFB84D" />
        <circle cx="994" cy="-104" r="11" fill="#FFB84D" />
        <circle cx="866" cy="-104" r="26" fill="#FFB84D" opacity=".22" />
        <circle cx="994" cy="-104" r="26" fill="#FFB84D" opacity=".22" />
        <g transform="translate(1040 -86)">
          <rect x="-3" y="0" width="6" height="86" fill="#2F6B4F" />
          <circle cx="0" cy="-8" r="26" fill="#FFFDF8" stroke="#1F4D3A" strokeWidth="5" />
          <text x="0" y="3" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontWeight="800" fontSize="30" fill="#1F4D3A">M</text>
        </g>
      </g>
      {/* the shop at the end of the ride */}
      <g transform={`translate(3380 ${GY})`}>
        <rect x="0" y="-300" width="400" height="300" fill="#E8DCC1" />
        <rect x="386" y="-300" width="14" height="300" fill="#000" opacity=".07" />
        <path d="M-6 -300L14 -334H386L406 -300z" fill="#58665F" />
        {[0, 1, 2].map(k => (
          <g key={k}>
            <rect x={40 + k * 120} y="-270" width="34" height="48" rx="3" fill="#7D8C86" />
            <rect x={34 + k * 120} y="-222" width="46" height="5" fill="#4C5A55" />
          </g>
        ))}
        <rect x="14" y="-150" width="372" height="150" fill="#3C5248" />
        <rect x="52" y="-208" width="250" height="40" rx="6" fill="#1F4D3A" />
        <text x="177" y="-179" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fontSize="26" fill="#F6F1E7">Brocante</text>
        <rect x="40" y="-120" width="190" height="104" rx="6" fill="#CFE3E0" />
        <rect x="40" y="-120" width="190" height="104" rx="6" fill="url(#hs-glass)" />
        <g transform="translate(135 -20)">
          <rect x="-26" y="-6" width="52" height="6" rx="3" fill="#8A6A4D" />
          <path d="M-8 -6L-6 -34H6L8 -6z" fill="#EFE6D2" stroke="#3C5248" strokeWidth="2" />
          <path d="M-22 -34L-12 -66H12L22 -34z" fill="#F6EBC8" stroke="#3C5248" strokeWidth="2" />
          <ellipse cx="0" cy="-48" rx="40" ry="26" fill="#FFF3C4" opacity=".35" />
        </g>
        <rect x="262" y="-120" width="62" height="120" rx="4" fill="#CFE3E0" />
        <rect x="262" y="-120" width="62" height="120" rx="4" fill="url(#hs-glass)" />
        <rect x="262" y="-120" width="62" height="120" rx="4" fill="none" stroke="#1F4D3A" strokeWidth="5" />
        <circle cx="314" cy="-58" r="3.5" fill="#1F4D3A" />
        <path d="M24 -150h292l-12 22h-268z" fill="#A14947" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map(k => (
          <path key={k} d={`M${24 + k * 36.5} -150h18.2l-3 22h-12.2z`} fill="#FFFDF8" opacity=".9" />
        ))}
        <rect x="336" y="-112" width="42" height="24" rx="4" fill="#FFFDF8" />
        <text x="357" y="-95" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontWeight="800" fontSize="12" fill="#1F4D3A">OPEN</text>
      </g>
      <defs>
        <linearGradient id="hs-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity=".15" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function Underground() {
  const steps = (x0, y0, dir) => {
    let d = `M${x0} ${y0}`
    for (let i = 0; i < 10; i++) d += `h${30 * dir}v32`
    return d
  }
  const posters = [
    [1260, '#A14947', 'heart'],
    [1880, '#1F4D3A', 'pin'],
    [2110, '#2F6BA8', 'bag'],
    [2440, '#A14947', 'heart'],
  ]
  const lights = []
  for (let x = 1200; x < 2640; x += 150) lights.push(x)
  return (
    <svg className="hs-svg" style={{ left: -200, top: 400 }} width="4100" height="520" viewBox="-200 400 4100 520" aria-hidden="true">
      <defs>
        <linearGradient id="hs-soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#76624C" />
          <stop offset="1" stopColor="#3B332A" />
        </linearGradient>
        <pattern id="hs-tile" width="44" height="22" patternUnits="userSpaceOnUse">
          <rect width="44" height="22" fill="#F3EFE2" />
          <rect x="1" y="1" width="42" height="20" rx="2" fill="#F8F5EC" />
          <path d="M0 .5H44M.5 0V22" stroke="#D5CDB8" strokeWidth="1.5" />
        </pattern>
        <linearGradient id="hs-vault" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset=".35" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".1" />
        </linearGradient>
        <clipPath id="hs-cavity">
          <polygon points="860,400 1160,720 2640,720 2940,400 2781,400 2687,500 1113,500 1019,400" />
        </clipPath>
        <linearGradient id="hs-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF3C4" stopOpacity=".55" />
          <stop offset="1" stopColor="#FFF3C4" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* the cut-away block: street slab, then soil */}
      <rect x="-200" y="422" width="4100" height="500" fill="url(#hs-soil)" />
      {[460, 540, 640, 780, 840].map((y, i) => (
        <path key={y} d={`M-200 ${y}q500 ${i % 2 ? -22 : 22} 1000 0t1000 0t1000 0t1100 0`} fill="none" stroke={i % 2 ? '#8E7A62' : '#2C261F'} strokeWidth="3" opacity=".35" />
      ))}
      {[[300, 620, 14], [560, 520, 10], [3300, 650, 16], [3600, 540, 10], [3050, 780, 12], [80, 760, 11]].map(([x, y, r]) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r} fill="#6F5F4D" />
          <circle cx={x - r / 3} cy={y - r / 3} r={r / 3} fill="#9C8A74" />
        </g>
      ))}
      {[[200, 560], [3500, 600]].map(([x, y]) => (
        <g key={x}>
          <rect x={x - 400} y={y - 8} width="800" height="16" rx="8" fill="#3F6F78" opacity=".75" />
          <rect x={x - 400} y={y - 5} width="800" height="4" rx="2" fill="#8FC2C9" opacity=".6" />
        </g>
      ))}
      {[120, 770, 3050, 3820].map(x => (
        <g key={x} fill="none" stroke="#5A4634" strokeLinecap="round" opacity=".75">
          <path d={`M${x} 422q-6 40 -46 62q-26 14 -48 8`} strokeWidth="7" />
          <path d={`M${x} 422q8 46 36 70q22 18 52 16`} strokeWidth="6" />
          <path d={`M${x} 422q-2 70 -14 120`} strokeWidth="5" />
          <path d={`M${x - 46} 484q-20 6 -30 22M${x + 36} 492q18 0 34 18`} strokeWidth="3" />
        </g>
      ))}
      {[[380, 470], [3400, 760]].map(([x, y]) => (
        <g key={x}>
          <rect x={x - 90} y={y} width="180" height="26" rx="6" fill="#4A4036" />
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={x - 80 + i * 42} y={y + 6} width="34" height="14" rx="4" fill={['#F2B84B', '#2F7DF6', '#A14947', '#8FC2C9'][i]} opacity=".85" />
          ))}
        </g>
      ))}
      <rect x="-200" y="400" width="4100" height="22" fill="#D6CCB6" />
      <rect x="-200" y="400" width="4100" height="4" fill="#EFE6D2" />
      {Array.from({ length: 70 }, (_, i) => (
        <rect key={i} x={-200 + i * 60} y="404" width="2" height="18" fill="#B8AD94" opacity=".7" />
      ))}

      {/* the métro: tiled hall and the two stairwells */}
      <polygon points="860,400 1160,720 2640,720 2940,400 2781,400 2687,500 1113,500 1019,400" fill="url(#hs-tile)" />
      <g clipPath="url(#hs-cavity)">
        <rect x="860" y="400" width="2100" height="330" fill="url(#hs-vault)" />
        {lights.map(x => (
          <g key={x}>
            <rect x={x - 28} y="503" width="56" height="7" rx="3" fill="#FFF8DC" />
            <polygon points={`${x - 28},510 ${x + 28},510 ${x + 70},720 ${x - 70},720`} fill="url(#hs-light)" opacity=".5" />
          </g>
        ))}
        {/* wall details */}
        {posters.map(([x, c, k]) => (
          <g key={x} transform={`translate(${x} 548)`}>
            <rect width="84" height="116" rx="4" fill={c} />
            <rect x="6" y="6" width="72" height="104" rx="3" fill="#FFFDF8" opacity=".12" />
            {k === 'heart' && <path d="M42 78C20 62 24 38 36 38c5 0 6 4 6 6 0-2 1-6 6-6 12 0 16 24-6 40z" fill="#FFFDF8" />}
            {k === 'pin' && <path d="M42 84L30 62a15 15 0 1 1 24 0z M42 52a5 5 0 1 0 0 .1z" fill="#FFFDF8" fillRule="evenodd" />}
            {k === 'bag' && <path d="M26 52h32l4 38H22zM34 52a8 8 0 0 1 16 0" fill="none" stroke="#FFFDF8" strokeWidth="5" strokeLinejoin="round" />}
          </g>
        ))}
        {/* station name plates, blue enamel as in Paris */}
        {[[1560, 'CHÂTELET'], [2300, 'SAINT-OUEN']].map(([x, name]) => (
          <g key={name} transform={`translate(${x} 522)`}>
            <rect x="-116" y="-14" width="232" height="40" rx="3" fill="#1E3F7A" stroke="#F6F1E7" strokeWidth="3" />
            <text x="18" y="13" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontWeight="700" fontSize="20" letterSpacing="2" fill="#FFFDF8">{name}</text>
            <circle cx="-90" cy="6" r="14" fill="#6B2C9E" stroke="#FFFDF8" strokeWidth="2" />
            <text x="-90" y="12" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontWeight="800" fontSize="15" fill="#FFFDF8">14</text>
          </g>
        ))}
      </g>
      <polygon points="860,400 1160,720 2640,720 2940,400 2781,400 2687,500 1113,500 1019,400" fill="none" stroke="#B9AE94" strokeWidth="6" strokeLinejoin="round" />

      {/* stairs */}
      <path d={`${steps(860, 400, 1)}V745H860z`} fill="#BFB59E" />
      <path d={steps(860, 400, 1)} fill="none" stroke="#E5DCC6" strokeWidth="3" />
      <path d={`${steps(2940, 400, -1)}V745H2940z`} fill="#BFB59E" />
      <path d={steps(2940, 400, -1)} fill="none" stroke="#E5DCC6" strokeWidth="3" />
      <path d="M866 396L1166 716" stroke="#2F6B4F" strokeWidth="5" opacity=".0" />

      {/* platform floor, edge stripe and rails */}
      <rect x="1160" y="720" width="1480" height="25" fill="#CFC5AE" />
      <rect x="1160" y="720" width="1480" height="5" fill="#EFE6D2" />
      <rect x="1160" y="725" width="1480" height="3" fill="#F2B84B" opacity=".9" />
      <rect x="1100" y="745" width="1600" height="8" fill="#2B2F36" />
      {Array.from({ length: 56 }, (_, i) => (
        <rect key={i} x={1120 + i * 28} y="753" width="12" height="6" fill="#4B4F57" />
      ))}
      <rect x="-200" y="900" width="4100" height="20" fill="#2A241D" />
    </svg>
  )
}

/* ------------------------------------------------------------------ the character */

function Char({ setRef }) {
  const skin = '#D8A27C'
  const hair = '#2B1B17'
  return (
    <svg className="hs-char-svg" viewBox="0 0 100 190" width="78" height="148" aria-hidden="true">
      <ellipse cx="50" cy="186" rx="27" ry="5" fill="#000" opacity=".2" />
      <g ref={setRef('armB')}>
        <rect x="40.5" y="74" width="11" height="40" rx="5.5" fill="#17402F" />
        <circle cx="46" cy="115" r="6" fill={skin} />
      </g>
      <g ref={setRef('legB')}>
        <rect x="39" y="112" width="13" height="62" rx="6" fill="#2A374E" />
        <path d="M37 172h17c7 0 10 5 10 9v2H35z" fill="#FFFDF8" />
        <path d="M35 183h29" stroke="#A14947" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g ref={setRef('legF')}>
        <rect x="50" y="112" width="13" height="62" rx="6" fill="#34445F" />
        <path d="M48 172h17c7 0 10 5 10 9v2H46z" fill="#FFFDF8" />
        <path d="M46 183h29" stroke="#A14947" strokeWidth="3" strokeLinecap="round" />
      </g>
      <path d="M40 66q-9 20 -5 34l9 -3q-3 -13 4 -28z" fill="#8F3F3D" />
      <path d="M28 80Q28 64 46 64H56Q72 64 72 80V118Q72 127 64 127H36Q28 127 28 118Z" fill="#1F4D3A" />
      <path d="M50 66V127" stroke="#17402F" strokeWidth="2" />
      <rect x="32" y="104" width="14" height="10" rx="3" fill="#17402F" opacity=".7" />
      <rect x="45" y="55" width="10" height="13" fill={skin} />
      <ellipse cx="50" cy="65" rx="15" ry="7" fill="#A14947" />
      <g ref={setRef('head')}>
        <circle cx="50" cy="40" r="17" fill={skin} />
        <path d="M33 40Q30 20 50 20Q70 20 67 40Q61 30 50 30Q41 30 33 40z" fill={hair} />
        <path d="M33 38Q29 52 38 57L37 40z" fill={hair} />
        <circle cx="38" cy="19" r="8" fill={hair} />
        <circle cx="58" cy="42" r="2.3" fill={hair} />
        <path d="M54 36q4 -2 8 0" fill="none" stroke={hair} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M66 42q5 3 0 7" fill="none" stroke="#B9805C" strokeWidth="2" strokeLinecap="round" />
        <path d="M54 51q5 4 10 -1" fill="none" stroke="#7A3F2C" strokeWidth="2" strokeLinecap="round" />
        <circle cx="61" cy="48" r="3.4" fill="#F2A08A" opacity=".45" />
      </g>
      <g ref={setRef('armF')}>
        <rect x="50.5" y="74" width="11" height="40" rx="5.5" fill="#2A6A4F" />
        <circle cx="56" cy="115" r="6" fill={skin} />
        <g ref={setRef('phone')}>
          <rect x="58" y="97" width="15" height="27" rx="3.5" fill="#1E2A24" />
          <rect x="60" y="99.5" width="11" height="21" rx="2" fill="#FFFDF8" />
          <rect x="62" y="102" width="7" height="7" rx="1.5" fill="#A14947" />
        </g>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ the train */

function TrainBack() {
  return (
    <svg className="hs-svg" viewBox="0 0 520 200" width="520" height="200" aria-hidden="true">
      <rect x="0" y="14" width="520" height="176" rx="26" fill="#F3EBD8" />
      <rect x="0" y="14" width="520" height="60" rx="26" fill="#FFF8E5" opacity=".6" />
      <path d="M10 62H510" stroke="#B9BEC4" strokeWidth="4" />
      {[60, 200, 330, 460].map(x => (
        <g key={x}>
          <path d={`M${x} 62v16`} stroke="#8A8F96" strokeWidth="2" />
          <circle cx={x} cy="84" r="6" fill="none" stroke="#8A8F96" strokeWidth="2.5" />
        </g>
      ))}
      <rect x="10" y="146" width="76" height="30" rx="8" fill="#7A57B0" />
      <rect x="434" y="146" width="76" height="30" rx="8" fill="#7A57B0" />
      <rect x="176" y="146" width="168" height="30" rx="8" fill="#7A57B0" />
    </svg>
  )
}

function TrainFront({ setRef }) {
  const body = 'M26 14H494Q520 14 520 40V164Q520 190 494 190H26Q0 190 0 164V40Q0 14 26 14z'
  const doors = [86, 346]
  return (
    <svg className="hs-svg" viewBox="0 0 520 200" width="520" height="200" aria-hidden="true">
      <path
        fillRule="evenodd"
        fill="#F1F3F5"
        stroke="#C5CAD0"
        strokeWidth="2"
        d={`${body}M16 44h56v62H16zM196 44h128v62H196zM448 44h56v62H448zM86 36h88v154H86zM346 36h88v154H346z`}
      />
      <rect x="0" y="118" width="86" height="16" fill="#6B2C9E" />
      <rect x="174" y="118" width="172" height="16" fill="#6B2C9E" />
      <rect x="434" y="118" width="86" height="16" fill="#6B2C9E" />
      <rect x="16" y="44" width="56" height="62" fill="#BFD7E0" opacity=".28" />
      <rect x="196" y="44" width="128" height="62" fill="#BFD7E0" opacity=".28" />
      <rect x="448" y="44" width="56" height="62" fill="#BFD7E0" opacity=".28" />
      <g transform="translate(250 150)">
        <circle r="14" fill="#6B2C9E" stroke="#FFFDF8" strokeWidth="2.5" />
        <text y="5.5" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontWeight="800" fontSize="15" fill="#FFFDF8">14</text>
      </g>
      {doors.map((x, i) => (
        <g key={x}>
          <rect ref={setRef(`d${i}l`)} className="hs-door l" x={x} y="36" width="44" height="154" fill="#DDE2E8" fillOpacity=".34" stroke="#6B2C9E" strokeWidth="3" />
          <rect ref={setRef(`d${i}r`)} className="hs-door r" x={x + 44} y="36" width="44" height="154" fill="#DDE2E8" fillOpacity=".34" stroke="#6B2C9E" strokeWidth="3" />
          <rect x={x + 8} y="50" width="26" height="76" rx="3" fill="#BFD7E0" opacity=".55" className={`hs-glass-${i}`} />
        </g>
      ))}
      <circle cx="70" cy="192" r="11" fill="#2B2F36" />
      <circle cx="200" cy="192" r="11" fill="#2B2F36" />
      <circle cx="320" cy="192" r="11" fill="#2B2F36" />
      <circle cx="450" cy="192" r="11" fill="#2B2F36" />
      <rect x="0" y="180" width="520" height="10" fill="#2B2F36" opacity=".8" />
      <circle cx="514" cy="150" r="5" fill="#FFF2A8" />
      <rect x="180" y="6" width="160" height="8" rx="4" fill="#B9BEC4" />
    </svg>
  )
}

/* ------------------------------------------------------------------ the hero */

export default function HeroScene() {
  const { t, money } = useI18n()
  const [act, setAct] = useState(0)
  const [scale, setScale] = useState(1)
  const wrap = useRef(null)
  const refs = useRef({})
  const st = useRef({ t: 0, playing: !reducedMotion(), visible: true, snap: true, act: 0, cam: { x: 480, y: 300, z: 1 }, last: 0 })
  const setRef = key => el => {
    refs.current[key] = el
  }

  const words = [t('lp.h1a'), t('lp.h1b'), `${t('lp.h1c')} ${t('lp.h1d')}`]
  const title = id => {
    const k = `it.${id}`
    const s = t(k)
    return s === k ? pick(id).t : s
  }

  useEffect(() => {
    const el = wrap.current
    const ro = new ResizeObserver(() => setScale(Math.min(1.25, el.clientWidth / W)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const s = st.current
    const R = refs.current
    const el = wrap.current
    const io = new IntersectionObserver(([e]) => (s.visible = e.isIntersecting), { threshold: 0.05 })
    io.observe(el)

    const set = (node, tf, op) => {
      if (!node) return
      if (tf !== undefined) node.style.transform = tf
      if (op !== undefined) node.style.opacity = op
    }
    const rot = (node, a, x, y) => node && node.setAttribute('transform', `rotate(${a.toFixed(2)} ${x} ${y})`)

    const render = (tt, dt) => {
      const riding = tt >= RIDE[0] && tt < RIDE[1]
      const trainX = track(tt, TRAIN_X)
      const charX = riding ? trainX - DOOR : track(tt, WALK_X)
      const charY = groundY(charX)

      /* camera */
      const tx = tt < 12.5 ? track(tt, CAM_X) : clamp(charX + 150, 480, 3480)
      const ty = track(tt, CAM_Y)
      const tz = track(tt, ZOOM)
      const cam = s.cam
      if (s.snap) {
        cam.x = tx
        cam.y = ty
        cam.z = tz
        s.snap = false
      } else {
        const k = 1 - Math.exp(-dt * 3.4)
        cam.x += (tx - cam.x) * k
        cam.y += (ty - cam.y) * (1 - Math.exp(-dt * 6))
        cam.z += (tz - cam.z) * (1 - Math.exp(-dt * 6))
      }
      const L = (f, fy) => `translate(${(480 - cam.x * f * cam.z).toFixed(1)}px,${(280 - cam.y * fy * cam.z).toFixed(1)}px) scale(${cam.z.toFixed(4)})`
      set(R.far, L(0.22, 0.35))
      set(R.mid, L(0.5, 0.75))
      set(R.world, L(1, 1))
      set(R.fore, L(1.35, 1.1))

      /* character */
      const sp = Math.abs(track(tt + 0.03, WALK_X) - track(tt - 0.03, WALK_X)) / 0.06
      const amp = riding ? 0 : clamp(sp / 140, 0, 1)
      const phase = charX * 0.052
      const sw = Math.sin(phase)
      const bob = -Math.abs(Math.cos(phase)) * 3.2 * amp
      const cheer = seg(tt, 23.0, 23.35, 'out')
      const hop = -Math.abs(Math.sin((tt - 23.0) * 7.5)) * 14 * cheer * (1 - seg(tt, 24.1, 24.5))
      const hold = 1 - seg(tt, 12.0, 12.6)
      const rail = seg(tt, 16.55, 16.9) * (1 - seg(tt, 19.2, 19.5))
      const flick = pulse(tt, 1.05, 1.5) + pulse(tt, 2.55, 3.0) + pulse(tt, 4.15, 4.6)
      let armF = lerp(sw * 30 * amp, -74 + 24 * flick + Math.sin(tt * 2) * 1.5, hold)
      armF = lerp(armF, -146, rail)
      armF = lerp(armF, -150 + Math.sin(tt * 12) * 7, cheer)
      const armB = lerp(-sw * 28 * amp, 168 + Math.sin(tt * 12 + 1) * 7, cheer)
      rot(R.armF, armF, 56, 78)
      rot(R.armB, armB, 46, 78)
      rot(R.legF, sw * 32 * amp, 56, 114)
      rot(R.legB, -sw * 32 * amp, 46, 114)
      rot(R.head, Math.sin(tt * 1.6) * 1.5 + cheer * -4, 50, 56)
      if (R.phone) {
        R.phone.setAttribute('transform', `rotate(${(-armF - 8).toFixed(1)} 56 115)`)
        R.phone.style.opacity = hold
      }
      const cx = charX - 39
      const cy = charY - 148 + bob + hop
      set(R.char, `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0) rotate(${(amp * 2.5).toFixed(2)}deg)`)
      if (R.char) R.char.style.zIndex = riding ? 4 : 6

      /* the phone's beam towards the floating listing */
      if (R.beam) {
        const rad = (armF * Math.PI) / 180
        const hx = cx + 43.7 - Math.sin(rad) * 28.9
        const hy = cy + 60.8 + Math.cos(rad) * 28.9
        R.beam.setAttribute('d', `M${hx.toFixed(1)} ${hy.toFixed(1)}L${CARD_X - 128} ${CARD_Y - 92}L${CARD_X - 128} ${CARD_Y + 92}z`)
        R.beam.style.opacity = seg(tt, 0.3, 0.9, 'out') * (1 - seg(tt, 11.7, 12.3, 'in')) * hold * 0.9
      }

      /* the listings */
      const swipes = [1.4, 2.9, 4.5]
      const enter = seg(tt, 0.15, 1.0, 'back')
      const front = swipes.reduce((n, s0) => n + seg(tt, s0 + 0.15, s0 + 0.7, 'out'), 0)
      for (let i = 0; i < 4; i++) {
        const node = R[`card${i}`]
        const q = clamp(i - front, -1, 4)
        let x = 0
        let y = q * 16 + (1 - enter) * 120
        let z = -q * 60
        let rz = 0
        let sc = 1 - Math.max(q, 0) * 0.06
        let op = clamp(3 - q, 0, 1) * clamp(enter * 1.5, 0, 1) * (1 - seg(tt, 8.6, 9.2, 'in'))
        let stamp = 0
        if (i < 3) {
          const dir = i === 2 ? 1 : -1
          const wind = seg(tt, swipes[i] - 0.4, swipes[i], 'out')
          const p = seg(tt, swipes[i], swipes[i] + 0.55, 'in')
          x = dir * (wind * 26 + p * (i === 2 ? 130 : 640))
          rz = dir * (wind * 3 + p * (i === 2 ? 7 : 26))
          y += -p * 36
          z += p * 40
          if (i < 2) op *= 1 - clamp((p - 0.55) / 0.45, 0, 1)
          stamp = clamp(wind * 1.4 + p, 0, 1) * (i < 2 ? 1 - clamp((p - 0.7) / 0.3, 0, 1) : 1)
          if (i === 2) {
            // act 2: the saved listing flies into the saved panel
            const fly = seg(tt, 6.4, 7.35, 'io')
            const tx2 = PANEL.x + 95 - CARD_X
            const ty2 = PANEL.y + 74 - CARD_Y
            x = lerp(x, tx2, fly)
            y = lerp(y, ty2, fly) - Math.sin(fly * Math.PI) * 90
            sc = lerp(sc, 0.2, fly)
            rz = lerp(rz, -4, fly)
            op *= 1 - clamp((fly - 0.88) / 0.12, 0, 1)
          }
        }
        if (node) {
          node.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) perspective(1100px) translateZ(${z.toFixed(1)}px) rotateZ(${rz.toFixed(2)}deg) rotateY(${(-x / 60).toFixed(2)}deg) scale(${sc.toFixed(3)})`
          node.style.opacity = op.toFixed(3)
          node.style.setProperty('--stamp', stamp.toFixed(3))
        }
      }

      /* the saved panel, the heart burst, then the map */
      const pIn = seg(tt, 5.1, 5.9, 'out')
      const pOut = seg(tt, 8.9, 9.4, 'in')
      set(R.panel, `perspective(900px) translate3d(${((1 - pIn) * 60 + pOut * 30).toFixed(1)}px,0,0) rotateY(${((1 - pIn) * 28 - pOut * 20).toFixed(1)}deg) scale(${(1 - pOut * 0.2).toFixed(3)})`, (pIn * (1 - pOut)).toFixed(3))
      const rowIn = seg(tt, 7.15, 7.65, 'back')
      if (R.newrow) {
        R.newrow.style.maxHeight = `${(rowIn * 52).toFixed(1)}px`
        R.newrow.style.opacity = clamp(rowIn, 0, 1)
        R.newrow.style.transform = `scale(${lerp(0.7, 1, rowIn).toFixed(3)})`
      }
      if (R.count) R.count.textContent = tt >= 7.3 ? '4' : '3'
      const burst = seg(tt, 7.3, 8.2, 'out')
      for (let i = 0; i < 8; i++) {
        const node = R[`spark${i}`]
        if (!node) continue
        const a = (i / 8) * Math.PI * 2 + 0.3
        const r0 = (50 + (i % 3) * 16) * burst
        node.style.transform = `translate(${(Math.cos(a) * r0).toFixed(1)}px,${(Math.sin(a) * r0 - burst * 14).toFixed(1)}px) scale(${(burst > 0 ? 1 - burst * 0.4 : 0).toFixed(2)})`
        node.style.opacity = tt < 7.3 ? 0 : (1 - seg(tt, 7.7, 8.3, 'lin')).toFixed(3)
      }
      const mIn = seg(tt, 9.0, 9.8, 'back')
      const mOut = seg(tt, 11.8, 12.5, 'in')
      set(R.map, `perspective(900px) translate3d(0,${((1 - mIn) * 40 + mOut * 60).toFixed(1)}px,0) rotateX(${(lerp(62, 22, mIn) + mOut * 30).toFixed(1)}deg) rotateZ(${(Math.sin(tt * 0.9) * 1.6).toFixed(2)}deg) scale(${(mIn * (1 - mOut * 0.8)).toFixed(3)})`, (clamp(mIn, 0, 1) * (1 - mOut)).toFixed(3))
      if (R.route) R.route.style.strokeDashoffset = (1 - seg(tt, 9.8, 11.4, 'io')) * 520
      if (R.mtrain) {
        const u = seg(tt, 10.2, 11.5, 'io')
        const pt = R.route?.getPointAtLength ? R.route.getPointAtLength(u * 520) : { x: 0, y: 0 }
        R.mtrain.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`)
        R.mtrain.style.opacity = clamp(u * 8, 0, 1)
      }
      if (R.pin) R.pin.style.transform = `translateY(${((1 - seg(tt, 11.2, 11.6, 'back')) * -40).toFixed(1)}px)`
      if (R.pin) R.pin.style.opacity = seg(tt, 11.1, 11.3, 'lin')

      /* the train */
      if (R.trainBack && R.trainFront) {
        const vis = tt >= 13.9
        const tf = `translate3d(${(trainX - TRAIN_W / 2).toFixed(1)}px,${PF - 185}px,0)`
        R.trainBack.style.display = R.trainFront.style.display = vis ? 'block' : 'none'
        R.trainBack.style.transform = R.trainFront.style.transform = tf
        const o = tt < 18.5 ? track(tt, DOORS_A) : track(tt, DOORS_B)
        ;['d0l', 'd0r', 'd1l', 'd1r'].forEach(k => set(R[k], `scaleX(${(1 - o).toFixed(3)})`))
      }
      const spd = Math.abs(track(tt + 0.03, TRAIN_X) - track(tt - 0.03, TRAIN_X)) / 0.06
      if (R.speed) R.speed.style.opacity = clamp((spd - 250) / 900, 0, 0.8).toFixed(2)

      /* arrival */
      const pop = seg(tt, 23.0, 23.5, 'back')
      set(R.gift, `translate3d(${charX - 70}px,${charY - 330 - Math.sin((tt - 23) * 3) * 6}px,0) scale(${pop.toFixed(3)})`, clamp(pop, 0, 1) * (1 - seg(tt, 24.5, 25.2, 'lin')))
      const u = seg(tt, 23.05, 24.6, 'lin')
      for (let i = 0; i < 18; i++) {
        const node = R[`conf${i}`]
        if (!node) continue
        const a = (i / 18) * Math.PI * 2
        const v = 150 + (i % 4) * 55
        node.style.transform = `translate(${(charX + Math.cos(a) * v * u).toFixed(1)}px,${(charY - 200 + Math.sin(a) * v * 0.7 * u + 420 * u * u).toFixed(1)}px) rotate(${(u * 380 * (i % 2 ? 1 : -1)).toFixed(0)}deg)`
        node.style.opacity = tt < 23.05 ? 0 : (1 - clamp((u - 0.55) / 0.45, 0, 1)).toFixed(2)
      }

      /* words, chips, fade, tabs */
      for (let i = 0; i < 3; i++) {
        const a = ACTS[i]
        const inn = seg(tt, a.at + 0.1, a.at + 0.65, 'out')
        const out = i === 2 ? seg(tt, 22.8, 23.2, 'in') : seg(tt, a.end - 0.4, a.end + 0.1, 'in')
        const node = R[`word${i}`]
        if (node) {
          node.style.opacity = (inn * (1 - out)).toFixed(3)
          node.style.transform = `translate3d(${(-30 + inn * 30 - out * 30).toFixed(1)}px,${((1 - inn) * 28 - out * 28).toFixed(1)}px,0)`
        }
      }
      set(R.chipSave, `translateY(${((1 - seg(tt, 7.3, 7.8, 'back')) * 20).toFixed(1)}px)`, (seg(tt, 7.3, 7.6, 'lin') * (1 - seg(tt, 9.6, 10.0, 'lin'))).toFixed(3))
      set(R.chipRoute, `translateY(${((1 - seg(tt, 15.6, 16.1, 'back')) * 20).toFixed(1)}px)`, (seg(tt, 15.6, 15.9, 'lin') * (1 - seg(tt, 22.9, 23.2, 'lin'))).toFixed(3))
      set(R.chipDone, `translateY(${((1 - seg(tt, 23.1, 23.6, 'back')) * 20).toFixed(1)}px)`, (seg(tt, 23.1, 23.4, 'lin') * (1 - seg(tt, 24.6, 25.2, 'lin'))).toFixed(3))
      set(R.fade, undefined, Math.max(1 - seg(tt, 0, 0.5, 'out'), seg(tt, T - 0.7, T, 'in')).toFixed(3))
      const idx = tt < ACTS[1].at ? 0 : tt < ACTS[2].at ? 1 : 2
      if (idx !== s.act) {
        s.act = idx
        setAct(idx)
      }
      ACTS.forEach((a, i) => {
        const node = R[`prog${i}`]
        if (node) node.style.transform = `scaleX(${i === idx ? clamp((tt - a.at) / (a.end - a.at), 0, 1).toFixed(3) : 0})`
      })
    }

    let raf = 0
    s.last = 0
    const frame = now => {
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0.016
      s.last = now
      if (s.visible) {
        if (s.playing) {
          s.t += dt
          if (s.t >= T) {
            s.t = 0
            s.snap = true
          }
        }
        render(s.t, dt)
      }
      raf = requestAnimationFrame(frame)
    }
    render(s.playing ? 0 : ACTS[2].still, 0.016)
    if (!s.playing) s.t = ACTS[2].still
    raf = requestAnimationFrame(frame)

    el.__seek = (tt, hold) => {
      s.t = tt
      s.snap = true
      if (hold !== undefined) s.playing = !hold
      render(tt, 0.016)
    }
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [])

  const go = i => {
    const s = st.current
    s.t = s.playing ? ACTS[i].at : ACTS[i].still
    s.snap = true
    s.last = 0
    if (!s.playing) wrap.current.__seek(s.t)
  }

  const lean = e => {
    const el = wrap.current
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--ry', `${x * 7}deg`)
    el.style.setProperty('--rx', `${-y * 5}deg`)
  }
  const rest = () => {
    wrap.current.style.setProperty('--ry', '0deg')
    wrap.current.style.setProperty('--rx', '0deg')
  }

  const saved = [14, 13, 6]
  const confetti = Array.from({ length: 18 }, (_, i) => i)

  return (
    <div className="hs">
      <h1 className="sr">{words.join(' ')}</h1>
      <div className="hs-wrap" ref={wrap} onPointerMove={lean} onPointerLeave={rest} style={{ '--s': scale }}>
        <div className="hs-fit" style={{ height: H * scale }}>
          <div className="hs-design">
            <div className="hs-stage">
              <div className="hs-sky" aria-hidden="true">
                <i className="hs-sun" />
                <i className="hs-cloud c1" />
                <i className="hs-cloud c2" />
                <i className="hs-cloud c3" />
              </div>
              <div className="hs-layer" ref={setRef('far')}><Skyline /></div>
              <div className="hs-layer" ref={setRef('mid')}><Facades /></div>

              <div className="hs-layer hs-world" ref={setRef('world')}>
                <Underground />
                <Street />

                <div className="hs-train" ref={setRef('trainBack')} style={{ display: 'none', zIndex: 3 }}><TrainBack /></div>
                <div className="hs-char" ref={setRef('char')}><Char setRef={setRef} /></div>
                <div className="hs-train" ref={setRef('trainFront')} style={{ display: 'none', zIndex: 5 }}><TrainFront setRef={setRef} /></div>

                <svg className="hs-svg hs-beam" style={{ left: 0, top: 0 }} width="1" height="1" overflow="visible" aria-hidden="true">
                  <defs>
                    <linearGradient id="hs-beamg" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#FFFDF8" stopOpacity=".55" />
                      <stop offset="1" stopColor="#FFFDF8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path ref={setRef('beam')} d="M0 0" fill="url(#hs-beamg)" />
                </svg>

                {[0, 1, 2, 3].map(i => {
                  const id = [4, 2, 18, 14][i]
                  const it = pick(id)
                  return (
                    <div key={id} className="hs-card" ref={setRef(`card${i}`)} style={{ left: CARD_X - 125, top: CARD_Y - 88, zIndex: 20 - i }}>
                      <Art item={it} />
                      <div className="hs-card-body">
                        <b>{title(id)}</b>
                        <span className="hs-card-meta">
                          <i><Icon name="pin" size={13} />1.1 km</i>
                          <em>{money(it.p)}</em>
                        </span>
                      </div>
                      {i < 2 && <span className="hs-stamp no">{t('pass').toUpperCase()}</span>}
                      {i === 2 && <span className="hs-stamp yes">{t('save').toUpperCase()}</span>}
                    </div>
                  )
                })}

                <div className="hs-panel" ref={setRef('panel')} style={{ left: PANEL.x, top: PANEL.y }}>
                  <div className="hs-panel-h">
                    <b>{t('tab.saved')}</b>
                    <span><Icon name="heart" size={13} sw={2.4} /><em ref={setRef('count')}>3</em></span>
                  </div>
                  <div className="hs-row hs-newrow" ref={setRef('newrow')}>
                    <span className="hs-thumb"><Art item={pick(18)} /></span>
                    <b>{title(18)}</b>
                    <Icon name="heart" size={14} sw={2.4} />
                  </div>
                  {saved.map(id => (
                    <div key={id} className="hs-row">
                      <span className="hs-thumb"><Art item={pick(id)} /></span>
                      <b>{title(id)}</b>
                      <Icon name="heart" size={14} sw={2.4} />
                    </div>
                  ))}
                </div>
                {Array.from({ length: 8 }, (_, i) => (
                  <svg key={i} className="hs-spark" ref={setRef(`spark${i}`)} style={{ left: PANEL.x + 24, top: PANEL.y + 62 }} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <path d="M12 21C4 15 3 8 7.500 6.500 10 5.800 11.500 7.500 12 9c.5-1.500 2-3.200 4.500-2.500C21 8 20 15 12 21z" fill="#A14947" />
                  </svg>
                ))}

                <div className="hs-map" ref={setRef('map')} style={{ left: CARD_X - 170, top: CARD_Y - 120 }}>
                  <svg viewBox="0 0 340 220" width="340" height="220" aria-hidden="true">
                    <rect width="340" height="220" rx="22" fill="#EFE8D6" />
                    <path d="M-10 150C70 110 120 190 200 150S320 90 350 120V240H-10z" fill="#BBD7DA" />
                    <path d="M-10 156C70 116 120 196 200 156S320 96 350 126" fill="none" stroke="#9BC5CB" strokeWidth="3" />
                    <rect x="20" y="18" width="100" height="62" rx="8" fill="#D3E2BF" />
                    <path d="M0 60H340M0 120H340M80 0V220M170 0V220M260 0V220" stroke="#FFFDF8" strokeWidth="9" />
                    <path ref={setRef('route')} d="M58 168C96 168 108 120 160 112S250 106 286 58" fill="none" stroke="#6B2C9E" strokeWidth="9" strokeLinecap="round" strokeDasharray="520" strokeDashoffset="520" />
                    {[[58, 168], [160, 112], [286, 58]].map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r="8" fill="#FFFDF8" stroke="#6B2C9E" strokeWidth="4" />
                    ))}
                    <circle cx="58" cy="168" r="20" fill="#2F7DF6" opacity=".22" />
                    <circle cx="58" cy="168" r="7" fill="#2F7DF6" stroke="#fff" strokeWidth="3" />
                    <g ref={setRef('mtrain')}>
                      <rect x="-15" y="-9" width="30" height="18" rx="7" fill="#8B4DC4" stroke="#4A1F70" strokeWidth="2" />
                    </g>
                    <g ref={setRef('pin')} style={{ opacity: 0 }}>
                      <path d="M286 58l-9-15a22 22 0 1 1 18 0z" transform="translate(0 -4)" fill="#A14947" stroke="#FFFDF8" strokeWidth="3.500" />
                      <circle cx="286" cy="29" r="7" fill="#FFFDF8" />
                    </g>
                  </svg>
                </div>

                <div className="hs-gift" ref={setRef('gift')} style={{ opacity: 0 }}>
                  <div className="hs-gift-card"><Art item={pick(18)} /></div>
                  <b>{title(18)}</b>
                </div>
                {confetti.map(i => (
                  <i key={i} className={`hs-conf c${i % 4}`} ref={setRef(`conf${i}`)} />
                ))}
              </div>

              <div className="hs-layer" ref={setRef('fore')}><Foreground /></div>
              <div className="hs-speed" ref={setRef('speed')} aria-hidden="true" />

              <div className="hs-hud">
                {words.map((w, i) => (
                  <div key={i} className="hs-word" ref={setRef(`word${i}`)} aria-hidden="true">
                    {i === 2 ? <><i>{t('lp.h1c')}</i> {t('lp.h1d')}</> : w}
                  </div>
                ))}
                <div className="hs-chip hs-chip-save" ref={setRef('chipSave')}>
                  <Icon name="heart" size={15} sw={2.4} />{t('lp.savedFav')}
                </div>
                <div className="hs-chip hs-chip-route" ref={setRef('chipRoute')}>
                  <LineBadge id="14" />
                  <span>Châtelet → Saint-Ouen</span>
                  <span className="mono">{t('ha.eta', { n: 17 })}</span>
                </div>
                <div className="hs-chip hs-chip-route hs-chip-done" ref={setRef('chipDone')}>
                  <Icon name="check" size={15} sw={3} />{t('ha.arrived')}
                </div>
              </div>
              <div className="hs-fade" ref={setRef('fade')} />
            </div>
          </div>
        </div>
      </div>

      <div className="hs-tabs" role="tablist" aria-label={words.join(', ')}>
        {words.map((w, i) => (
          <button key={i} type="button" role="tab" aria-selected={act === i} className={`hs-tab${act === i ? ' on' : ''}`} onClick={() => go(i)}>
            <span className="hs-tab-n">{i + 1}</span>
            <span className="hs-tab-w">{w}</span>
            <i className="hs-prog" ref={setRef(`prog${i}`)} />
          </button>
        ))}
      </div>
    </div>
  )
}
