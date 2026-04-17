import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../../src/components/ui/Screen'
import { useAppStore, useLanguage } from '../../src/lib/store'
import { colors } from '../../src/constants/theme'

export default function OnboardingScreen() {
  const language = useLanguage()
  const setLanguage = useAppStore((s) => s.setLanguage)
  const tl = language === 'tl'

  return (
    <Screen>
      {/* Language toggle — top right */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setLanguage(tl ? 'en' : 'tl')}
          style={styles.langToggle}
        >
          <Text style={styles.langText}>{tl ? 'EN' : 'TL'}</Text>
        </TouchableOpacity>
      </View>

      {/* Logo / wordmark */}
      <View style={styles.logoArea}>
        <Text style={styles.logo}>Litro</Text>
        <Text style={styles.tagline}>
          {tl ? 'Para sa tindahan mo.' : 'Built for your store.'}
        </Text>
      </View>

      {/* Main actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryCard}
          onPress={() => router.push('/onboarding/create')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryCardEmoji}>🏪</Text>
          <Text style={styles.primaryCardTitle}>
            {tl ? 'Magsimula ng bagong tindahan' : 'Start a new store'}
          </Text>
          <Text style={styles.primaryCardSub}>
            {tl ? 'Libre. Walang email kailangan.' : 'Free. No email needed.'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryCard}
          onPress={() => router.push('/onboarding/join')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryCardTitle}>
            {tl ? 'Sumali sa tindahan' : 'Join a store'}
          </Text>
          <Text style={styles.secondaryCardSub}>
            {tl ? 'May access code ka na?' : 'Got an access code?'}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    paddingBottom: 8,
  },
  langToggle: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1A3530',
  },
  langText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: colors.grey,
    letterSpacing: 1,
  },
  logoArea: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 64,
    color: colors.green,
    letterSpacing: -2,
  },
  tagline: {
    fontFamily: 'DMSans-Regular',
    fontSize: 18,
    color: colors.grey,
  },
  actions: {
    gap: 12,
    paddingBottom: 32,
  },
  primaryCard: {
    backgroundColor: colors.green,
    borderRadius: 20,
    padding: 28,
    gap: 6,
  },
  primaryCardEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  primaryCardTitle: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 22,
    color: colors.dark,
    lineHeight: 28,
  },
  primaryCardSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#0D4035',
  },
  secondaryCard: {
    backgroundColor: '#0D1F1A',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1A3530',
    padding: 24,
    gap: 4,
  },
  secondaryCardTitle: {
    fontFamily: 'BricolageGrotesque-SemiBold',
    fontSize: 18,
    color: colors.pale,
  },
  secondaryCardSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.grey,
  },
})
