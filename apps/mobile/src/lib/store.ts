import { create } from 'zustand'
import type { CartItem, MilestoneKey } from '@litro/types'

interface AuthState {
  token: string
  storeId: string
  storeName: string
  staffId: string
  role: 'owner' | 'staff'
}

interface AppState {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: AuthState | null
  language: 'tl' | 'en'

  // ─── Cart ──────────────────────────────────────────────────────────────────
  cart: CartItem[]

  // ─── Onboarding / nudges ───────────────────────────────────────────────────
  /** Milestone waiting to show full-screen animation */
  pendingMilestone: MilestoneKey | null
  /** Has the home screen chatbot greeting been shown this session */
  greetingShown: boolean

  // ─── Actions ───────────────────────────────────────────────────────────────
  setAuth: (auth: AuthState) => void
  clearAuth: () => void
  setLanguage: (lang: 'tl' | 'en') => void

  addToCart: (item: CartItem) => void
  removeFromCart: (productId: string) => void
  setItemQuantity: (productId: string, quantity: number) => void
  updateCart: (cart: CartItem[]) => void
  clearCart: () => void

  setPendingMilestone: (key: MilestoneKey | null) => void
  markGreetingShown: () => void
}

export const useAppStore = create<AppState>((set) => ({
  auth: null,
  language: 'tl',
  cart: [],
  pendingMilestone: null,
  greetingShown: false,

  setAuth: (auth) => set({ auth }),
  clearAuth: () => set({ auth: null, cart: [] }),
  setLanguage: (language) => set({ language }),

  addToCart: (item) =>
    set((state) => {
      const idx = state.cart.findIndex((i) =>
        item.productId ? i.productId === item.productId : i.productName === item.productName
      )
      if (idx >= 0) {
        const updated = [...state.cart]
        const existing = updated[idx]
        const newQty = existing.quantity + item.quantity
        updated[idx] = { ...existing, quantity: newQty, subtotal: newQty * existing.unitPrice }
        return { cart: updated }
      }
      return { cart: [...state.cart, item] }
    }),

  removeFromCart: (productId) =>
    set((state) => ({ cart: state.cart.filter((i) => i.productId !== productId) })),

  setItemQuantity: (productId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { cart: state.cart.filter((i) => i.productId !== productId) }
      }
      return {
        cart: state.cart.map((i) =>
          i.productId === productId
            ? { ...i, quantity, subtotal: quantity * i.unitPrice }
            : i
        ),
      }
    }),

  updateCart: (cart) => set({ cart }),
  clearCart: () => set({ cart: [] }),

  setPendingMilestone: (pendingMilestone) => set({ pendingMilestone }),
  markGreetingShown: () => set({ greetingShown: true }),
}))

// Selectors
export const useAuth = () => useAppStore((s) => s.auth)
export const useLanguage = () => useAppStore((s) => s.language)
export const useCart = () => useAppStore((s) => s.cart)
export const useCartTotal = () =>
  useAppStore((s) => s.cart.reduce((sum, i) => sum + i.subtotal, 0))
export const useCartCount = () =>
  useAppStore((s) => s.cart.reduce((sum, i) => sum + i.quantity, 0))
