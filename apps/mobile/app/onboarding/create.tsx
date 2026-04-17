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

export default function CreateStore() {
  const language = useLanguage()
  const { setAuth, setPendingMilestone } = useAppStore()
  const tl = language === 'tl'

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(tl ? 'Ilagay ang pangalan ng tindahan.' : 'Enter your store name.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await api.post<{
        storeId: string
        accessCode: string
        recoveryCode: string
        token: string
      }>('/store/create', { name: trimmed, language })

      const auth = {
        token: data.token,
        storeId: data.storeId,
        storeName: trimmed,
        staffId: '',
        role: 'owner' as const,
      }

      setAuthToken(data.token)
      await saveSession(auth)
      setAuth(auth)
      setPendingMilestone('store_created')
      router.replace('/(app)')
    } catch (err) {
      setError(tl ? 'May error. Subukan ulit.' : 'Something went wrong. Try again.')
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
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← {tl ? 'Bumalik' : 'Back'}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>
            {tl ? 'Anong pangalan ng tindahan mo?' : "What's your store called?"}
          </Text>
          <Text style={styles.sub}>
            {tl
              ? 'Pwedeng palitan ito mamaya sa settings.'
              : 'You can change this later in settings.'}
          </Text>

          <Input
            value={name}
            onChangeText={(t) => { setName(t); setError('') }}
            placeholder={tl ? 'hal. Nanay\'s Sari-Sari' : 'e.g. Maria\'s Store'}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            error={error}
            style={styles.input}
          />
        </View>

        <View style={styles.footer}>
          <Button
            label={tl ? 'Ituloy' : 'Continue'}
            onPress={handleCreate}
            loading={loading}
            disabled={!name.trim()}
            fullWidth
            size="lg"
          />
          <Text style={styles.hint}>
            {tl
              ? 'Walang email kailangan. Libre magpakailanman.'
              : 'No email needed. Free forever.'}
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  back: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  backText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.grey,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 40,
  },
  title: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 28,
    color: colors.pale,
    lineHeight: 36,
  },
  sub: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.grey,
  },
  input: {
    fontSize: 20,
    paddingVertical: 18,
  },
  footer: {
    gap: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  hint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
    textAlign: 'center',
  },
})
