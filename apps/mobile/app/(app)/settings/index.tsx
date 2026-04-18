import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Modal,
  Pressable,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../../../src/components/ui/Screen'
import { api } from '../../../src/lib/api'
import { useAppStore, useAuth, useLanguage } from '../../../src/lib/store'
import { clearSession } from '../../../src/lib/session'
import { setAuthToken } from '../../../src/lib/api'
import { colors } from '../../../src/constants/theme'

interface StoreSettings {
  accessCode: string
  language: 'tl' | 'en'
  proMode: boolean
}

export default function SettingsScreen() {
  const language = useLanguage()
  const auth = useAuth()
  const { setLanguage, clearAuth } = useAppStore()
  const tl = language === 'tl'
  const isOwner = auth?.role === 'owner'
  const queryClient = useQueryClient()

  const [codeVisible, setCodeVisible] = useState(false)

  const { data: settings } = useQuery<StoreSettings>({
    queryKey: ['settings'],
    queryFn: () => api.get<StoreSettings>('/store'),
    enabled: isOwner,
  })

  const regenMutation = useMutation({
    mutationFn: () => api.post('/store/regenerate-code', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const handleLogout = async () => {
    Alert.alert(
      tl ? 'Mag-logout?' : 'Log out?',
      tl
        ? 'Aalisin ang iyong session sa device na ito.'
        : 'Your session will be removed from this device.',
      [
        { text: tl ? 'Kanselahin' : 'Cancel', style: 'cancel' },
        {
          text: tl ? 'Mag-logout' : 'Log out',
          style: 'destructive',
          onPress: async () => {
            await clearSession()
            setAuthToken(null)
            clearAuth()
            router.replace('/onboarding')
          },
        },
      ]
    )
  }

  const confirmRegen = () => {
    Alert.alert(
      tl ? 'Palitan ang access code?' : 'Regenerate access code?',
      tl
        ? 'Ang lahat ng kasalukuyang staff ay ma-di-disconnect. Bibigyan sila ng bagong code.'
        : 'All current staff will be disconnected. You\'ll need to share the new code.',
      [
        { text: tl ? 'Kanselahin' : 'Cancel', style: 'cancel' },
        {
          text: tl ? 'Palitan' : 'Regenerate',
          style: 'destructive',
          onPress: () => regenMutation.mutate(),
        },
      ]
    )
  }

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.pale} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Store info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{tl ? 'Tindahan' : 'Store'}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{tl ? 'Pangalan' : 'Name'}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{auth?.storeName}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{tl ? 'Role' : 'Role'}</Text>
              <Text style={styles.rowValue}>
                {auth?.role === 'owner' ? (tl ? 'May-ari' : 'Owner') : (tl ? 'Staff' : 'Staff')}
              </Text>
            </View>
          </View>
        </View>

        {/* Access code (owner only) */}
        {isOwner && settings?.accessCode && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{tl ? 'Access code ng tindahan' : 'Store access code'}</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{tl ? 'Code' : 'Code'}</Text>
                <View style={styles.codeRow}>
                  <Text style={[styles.code, !codeVisible && styles.codeHidden]}>
                    {codeVisible ? settings.accessCode : '••••••••'}
                  </Text>
                  <TouchableOpacity onPress={() => setCodeVisible((v) => !v)} hitSlop={8}>
                    <Ionicons
                      name={codeVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.grey}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.actionRow}
                onPress={confirmRegen}
                disabled={regenMutation.isPending}
              >
                <Ionicons name="refresh-outline" size={18} color="#F59E0B" />
                <Text style={styles.actionLabelWarn}>
                  {regenMutation.isPending
                    ? (tl ? 'Pinalitan...' : 'Regenerating...')
                    : (tl ? 'Palitan ang code' : 'Regenerate code')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{tl ? 'Wika ng chatbot' : 'Chatbot language'}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.langOption, language === 'tl' && styles.langOptionActive]}
              onPress={() => setLanguage('tl')}
            >
              {language === 'tl' && (
                <Ionicons name="checkmark" size={16} color={colors.green} />
              )}
              <Text style={[styles.langLabel, language === 'tl' && styles.langLabelActive]}>
                🇵🇭 Tagalog / Filipino
              </Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.langOption, language === 'en' && styles.langOptionActive]}
              onPress={() => setLanguage('en')}
            >
              {language === 'en' && (
                <Ionicons name="checkmark" size={16} color={colors.green} />
              )}
              <Text style={[styles.langLabel, language === 'en' && styles.langLabelActive]}>
                🇺🇸 English
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionHint}>
            {tl
              ? 'Ang setting na ito ay para sa mga sagot ng chatbot. Puwede kang magsulat sa kahit anong wika.'
              : 'This controls chatbot responses only. You can type in any language.'}
          </Text>
        </View>

        {/* App version */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{tl ? 'App' : 'App'}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Litro</Text>
              <Text style={styles.rowValue}>v1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#D94F4F" />
          <Text style={styles.logoutLabel}>{tl ? 'Mag-logout' : 'Log out'}</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    flex: 1,
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 20,
    color: colors.pale,
  },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: colors.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#2A4A40',
    marginTop: 8,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#0D1F1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1A3530',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  rowLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.grey,
  },
  rowValue: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.pale,
    maxWidth: '55%',
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: '#1A3530', marginHorizontal: 14 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 18,
    color: colors.green,
    letterSpacing: 2,
  },
  codeHidden: { letterSpacing: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  actionLabelWarn: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#F59E0B',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  langOptionActive: {},
  langLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.pale,
  },
  langLabelActive: { color: colors.green, fontFamily: 'DMSans-Medium' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#3D1515',
    marginBottom: 12,
  },
  logoutLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: '#D94F4F',
  },
})
