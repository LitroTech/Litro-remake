import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../src/components/ui/Screen'
import { Input } from '../../src/components/ui/Input'
import { Button } from '../../src/components/ui/Button'
import { useAppStore, useLanguage } from '../../src/lib/store'
import { saveSession } from '../../src/lib/session'
import { api, setAuthToken } from '../../src/lib/api'
import { colors } from '../../src/constants/theme'

export default function JoinStore() {
  const language = useLanguage()
  const { setAuth } = useAppStore()
  const tl = language === 'tl'

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    const trimmedCode = code.trim().toUpperCase()
    const trimmedName = name.trim()

    if (trimmedCode.length !== 8) {
      setError(tl ? '8 characters ang access code.' : 'Access code is 8 characters.')
      return
    }
    if (!trimmedName) {
      setError(tl ? 'Ilagay ang pangalan mo.' : 'Enter your name.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await api.post<{
        storeId: string
        storeName: string
        staffId: string
        token: string
      }>('/store/join', { accessCode: trimmedCode, name: trimmedName })

      const auth = {
        token: data.token,
        storeId: data.storeId,
        storeName: data.storeName,
        staffId: data.staffId,
        role: 'staff' as const,
      }

      setAuthToken(data.token)
      await saveSession(auth)
      setAuth(auth)
      router.replace('/(app)/checkout')
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (msg.includes('Invalid')) {
        setError(tl ? 'Mali ang access code. Subukan ulit.' : 'Invalid access code. Try again.')
      } else {
        setError(tl ? 'May error. Subukan ulit.' : 'Something went wrong.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← {tl ? 'Bumalik' : 'Back'}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>
            {tl ? 'Sumali sa tindahan' : 'Join a store'}
          </Text>
          <Text style={styles.sub}>
            {tl
              ? 'Humingi ng access code sa may-ari ng tindahan.'
              : 'Ask the store owner for the access code.'}
          </Text>

          <View style={styles.fields}>
            <Input
              label={tl ? 'Access code' : 'Access code'}
              value={code}
              onChangeText={(t) => { setCode(t.toUpperCase()); setError('') }}
              placeholder="XXXXXXXX"
              autoCapitalize="characters"
              maxLength={8}
              returnKeyType="next"
            />
            <Input
              label={tl ? 'Pangalan mo' : 'Your name'}
              value={name}
              onChangeText={(t) => { setName(t); setError('') }}
              placeholder={tl ? 'hal. Juan' : 'e.g. Juan'}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
              error={error}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            label={tl ? 'Sumali' : 'Join'}
            onPress={handleJoin}
            loading={loading}
            disabled={code.trim().length !== 8 || !name.trim()}
            fullWidth
            size="lg"
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  back: { paddingTop: 12, paddingBottom: 8 },
  backText: { fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.grey },
  content: { flex: 1, gap: 16, paddingVertical: 40 },
  title: { fontFamily: 'BricolageGrotesque-Bold', fontSize: 28, color: colors.pale, lineHeight: 36 },
  sub: { fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.grey },
  fields: { gap: 16, marginTop: 8 },
  footer: { gap: 16, paddingBottom: 32 },
})
