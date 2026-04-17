import { useEffect } from 'react'
import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { loadSession } from '../src/lib/session'
import { useAppStore } from '../src/lib/store'
import { setAuthToken } from '../src/lib/api'
import { colors } from '../src/constants/theme'

export default function Entry() {
  const { auth, setAuth } = useAppStore()

  useEffect(() => {
    loadSession().then((stored) => {
      if (stored) {
        setAuthToken(stored.token)
        setAuth(stored)
      }
    })
  }, [])

  // Show spinner on first load before session resolves
  if (auth === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  return auth ? <Redirect href="/(app)" /> : <Redirect href="/onboarding" />
}
