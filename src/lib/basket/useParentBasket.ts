'use client'

import { useBasketContext } from './BasketContext'

export function useParentBasket() {
  return useBasketContext()
}
