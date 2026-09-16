'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { ParentBasketItem, AddItemPayload } from './types'

// v2: discriminated union replaces the old { studentId, activityId } shape
const STORAGE_KEY = 'scoilbhride-parent-basket-v2'

function makeKey(item: AddItemPayload): string {
  return item.kind === 'activity'
    ? `activity:${item.studentId}:${item.activityId}`
    : `programme:${item.studentId}:${item.programmeId}`
}

function readFromStorage(): ParentBasketItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ParentBasketItem[]) : []
  } catch {
    return []
  }
}

function writeToStorage(items: ParentBasketItem[]): void {
  try {
    if (items.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY)
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
  } catch {
    // sessionStorage unavailable (private browsing edge cases) — silently continue
  }
}

interface BasketContextValue {
  items: ParentBasketItem[]
  loaded: boolean
  addItem: (item: AddItemPayload) => void
  removeItem: (key: string) => void
  clearBasket: () => void
  isActivityInBasket: (studentId: string, activityId: string) => boolean
  isProgrammeInBasket: (studentId: string, programmeId: string) => boolean
}

const BasketContext = createContext<BasketContextValue | null>(null)

export function ParentBasketProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ParentBasketItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setItems(readFromStorage())
    setLoaded(true)
  }, [])

  const addItem = useCallback((item: AddItemPayload) => {
    const key = makeKey(item)
    setItems((prev) => {
      if (prev.some((i) => i.key === key)) return prev
      const next = [...prev, { ...item, key } as ParentBasketItem]
      writeToStorage(next)
      return next
    })
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key)
      writeToStorage(next)
      return next
    })
  }, [])

  const clearBasket = useCallback(() => {
    setItems([])
    writeToStorage([])
  }, [])

  const isActivityInBasket = useCallback(
    (studentId: string, activityId: string) =>
      items.some((i) => i.key === `activity:${studentId}:${activityId}`),
    [items],
  )

  const isProgrammeInBasket = useCallback(
    (studentId: string, programmeId: string) =>
      items.some((i) => i.key === `programme:${studentId}:${programmeId}`),
    [items],
  )

  return (
    <BasketContext.Provider
      value={{
        items,
        loaded,
        addItem,
        removeItem,
        clearBasket,
        isActivityInBasket,
        isProgrammeInBasket,
      }}
    >
      {children}
    </BasketContext.Provider>
  )
}

export function useBasketContext(): BasketContextValue {
  const ctx = useContext(BasketContext)
  if (!ctx) throw new Error('useBasketContext must be used within ParentBasketProvider')
  return ctx
}
