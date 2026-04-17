import { create } from 'zustand'
import type { CartItem, PaymentMethod, Session } from '@litro/types'

interface AppState {
  session: Session | null
  cart: CartItem[]
  setSession: (session: Session | null) => void
  addToCart: (item: CartItem) => void
  updateCart: (cart: CartItem[]) => void
  clearCart: () => void
}

export const useAppStore = create<AppState>((set) => ({
  session: null,
  cart: [],

  setSession: (session) => set({ session }),

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.findIndex((i) => i.productId === item.productId)
      if (existing >= 0) {
        const updated = [...state.cart]
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + item.quantity,
          subtotal: (updated[existing].quantity + item.quantity) * updated[existing].unitPrice,
        }
        return { cart: updated }
      }
      return { cart: [...state.cart, item] }
    }),

  updateCart: (cart) => set({ cart }),

  clearCart: () => set({ cart: [] }),
}))
