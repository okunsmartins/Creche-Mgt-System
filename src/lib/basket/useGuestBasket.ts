'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  GuestBasket,
  GuestBasketActivity,
  GuestBasketProgramme,
  GuestIdentification,
} from './types'

const STORAGE_KEY = 'scoilbhride-guest-basket-v2'

function readFromStorage(): GuestBasket | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GuestBasket
    // Defensive normalisation for baskets written before programmes were added
    if (!Array.isArray(parsed.programmes)) parsed.programmes = []
    return parsed
  } catch {
    return null
  }
}

function writeToStorage(basket: GuestBasket | null): void {
  try {
    if (!basket) {
      sessionStorage.removeItem(STORAGE_KEY)
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(basket))
    }
  } catch {
    // sessionStorage unavailable — silently continue
  }
}

export function useGuestBasket() {
  const [basket, setBasket] = useState<GuestBasket | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setBasket(readFromStorage())
    setLoaded(true)
  }, [])

  const setIdentification = useCallback(
    (identification: GuestIdentification, paymentLinkId?: string) => {
      setBasket((prev) => {
        const next: GuestBasket = {
          ...identification,
          activities: prev?.activities ?? [],
          programmes: prev?.programmes ?? [],
          ...(paymentLinkId ? { paymentLinkId } : {}),
        }
        writeToStorage(next)
        return next
      })
    },
    [],
  )

  const addActivity = useCallback((activity: GuestBasketActivity) => {
    setBasket((prev) => {
      if (!prev) return prev
      if (prev.activities.some((a) => a.activityId === activity.activityId)) return prev
      const next: GuestBasket = { ...prev, activities: [...prev.activities, activity] }
      writeToStorage(next)
      return next
    })
  }, [])

  const removeActivity = useCallback((activityId: string) => {
    setBasket((prev) => {
      if (!prev) return prev
      const next: GuestBasket = {
        ...prev,
        activities: prev.activities.filter((a) => a.activityId !== activityId),
      }
      writeToStorage(next)
      return next
    })
  }, [])

  const addProgramme = useCallback((programme: GuestBasketProgramme) => {
    setBasket((prev) => {
      if (!prev) return prev
      if (prev.programmes.some((p) => p.programmeId === programme.programmeId)) return prev
      const next: GuestBasket = { ...prev, programmes: [...prev.programmes, programme] }
      writeToStorage(next)
      return next
    })
  }, [])

  const removeProgramme = useCallback((programmeId: string) => {
    setBasket((prev) => {
      if (!prev) return prev
      const next: GuestBasket = {
        ...prev,
        programmes: prev.programmes.filter((p) => p.programmeId !== programmeId),
      }
      writeToStorage(next)
      return next
    })
  }, [])

  const clearBasket = useCallback(() => {
    setBasket(null)
    writeToStorage(null)
  }, [])

  const isActivityInBasket = useCallback(
    (activityId: string) => basket?.activities.some((a) => a.activityId === activityId) ?? false,
    [basket],
  )

  const isProgrammeInBasket = useCallback(
    (programmeId: string) => basket?.programmes.some((p) => p.programmeId === programmeId) ?? false,
    [basket],
  )

  return {
    basket,
    loaded,
    setIdentification,
    addActivity,
    removeActivity,
    addProgramme,
    removeProgramme,
    clearBasket,
    isActivityInBasket,
    isProgrammeInBasket,
  }
}
