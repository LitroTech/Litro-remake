import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'litro_token'
const AUTH_KEY = 'litro_auth'

export interface StoredAuth {
  token: string
  storeId: string
  storeName: string
  staffId: string
  role: 'owner' | 'staff'
}

export async function saveSession(auth: StoredAuth): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, auth.token)
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(auth))
}

export async function loadSession(): Promise<StoredAuth | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(AUTH_KEY)
}
