import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as SecureStore from 'expo-secure-store'
import type { CartItem, Session } from '@litro/types'
import { setAuthToken } from './api'

interface AppState {
  session: Session | null
  cart: CartItem[]
  setSession: (session: Session | null) => void
  addToCart: (item: CartItem) => void
  updateCart: (cart: CartItem[]) => void
  clearCart: () => void
  logout: () => void
}

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(name)
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name)
  },
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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
              subtotal: (updated[existing].quantity + item.quantity) * Number(updated[existing].unitPrice),
            }
            return { cart: updated }
          }
          return { cart: [...state.cart, item] }
        }),

      updateCart: (cart) => set({ cart }),

      clearCart: () => set({ cart: [] }),

      logout: () => {
        setAuthToken(null)
        set({ session: null, cart: [] })
      },
    }),
    {
      name: 'litro-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
)

