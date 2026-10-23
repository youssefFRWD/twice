import { useCallback, useEffect, useState } from 'react'

const KEY = 'twice.boards'
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v.filter(b => b && typeof b.id === 'string' && typeof b.name === 'string' && Array.isArray(b.ids)) : []
  } catch {
    return []
  }
}

/** Named boards of saved items, kept in this browser. An item can sit on several boards. */
export function useBoards() {
  const [boards, setBoards] = useState(read)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(boards))
    } catch {
      /* storage unavailable: boards last for this visit only */
    }
  }, [boards])

  const create = useCallback((name, ids = []) => {
    const clean = name.trim().slice(0, 40)
    if (!clean) return null
    const existing = boards.find(b => b.name.toLowerCase() === clean.toLowerCase())
    if (existing) {
      setBoards(bs => bs.map(b => (b.id === existing.id ? { ...b, ids: [...new Set([...b.ids, ...ids])] } : b)))
      return existing.id
    }
    const id = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
    setBoards(bs => [...bs, { id, name: clean, ids: [...new Set(ids)] }])
    return id
  }, [boards])
  const remove = useCallback(id => setBoards(bs => bs.filter(b => b.id !== id)), [])
  const toggle = useCallback((id, itemId) => setBoards(bs => bs.map(b => (b.id === id ? { ...b, ids: b.ids.includes(itemId) ? b.ids.filter(x => x !== itemId) : [...b.ids, itemId] } : b))), [])
  const addMany = useCallback((id, itemIds) => setBoards(bs => bs.map(b => (b.id === id ? { ...b, ids: [...new Set([...b.ids, ...itemIds])] } : b))), [])
  return { boards, create, remove, toggle, addMany }
}
