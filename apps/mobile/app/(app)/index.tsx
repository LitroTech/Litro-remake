import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../../src/components/ui/Screen'
import { MilestoneModal } from '../../src/components/ui/MilestoneModal'
import { useAppStore, useAuth, useLanguage } from '../../src/lib/store'
import { clearSession } from '../../src/lib/session'
import { setAuthToken } from '../../src/lib/api'
import { colors } from '../../src/constants/theme'

export default function HomeScreen() {
  const auth = useAuth()
  const language = useLanguage()
  const { pendingMilestone, setPendingMilestone, greetingShown, markGreetingShown, clearAuth } =
    useAppStore()

  const tl = language === 'tl'
  const [menuOpen, setMenuOpen] = useState(false)
  const [greeting, setGreeting] = useState<string | null>(null)

  // Greeting bubble animation
  const greetingOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (greetingShown) return
    const msg = tl
      ? `Kumusta, ${auth?.storeName}! Handa ka na ba? I-tap ang Checkout para magsimula.`
      : `Welcome, ${auth?.storeName}! Ready to sell? Tap Checkout to get started.`
    setGreeting(msg)
    markGreetingShown()
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(greetingOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    await clearSession()
    setAuthToken(null)
    clearAuth()
    router.replace('/onboarding')
  }

  const MENU_ITEMS = [
    { label: tl ? 'Kasaysayan ng transaksyon' : 'Transaction history', icon: 'receipt-outline', route: '/(app)/history' },
    { label: tl ? 'Mga gastos' : 'Expenses', icon: 'wallet-outline', route: '/(app)/expenses' },
    { label: tl ? 'Mga staff' : 'Staff', icon: 'people-outline', route: '/(app)/staff' },
    { label: tl ? 'Mga may tab' : 'Credits', icon: 'card-outline', route: '/(app)/credits' },
    { label: tl ? 'Access code ng tindahan' : 'Store access code', icon: 'qr-code-outline', route: '/(app)/settings' },
    { label: tl ? 'Settings' : 'Settings', icon: 'settings-outline', route: '/(app)/settings' },
  ]

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.storeName} numberOfLines={1}>{auth?.storeName}</Text>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={12}>
          <Ionicons name="menu" size={28} color={colors.pale} />
        </TouchableOpacity>
      </View>

      {/* Chatbot greeting bubble */}
      {greeting && (
        <Animated.View style={[styles.greeting, { opacity: greetingOpacity }]}>
          <View style={styles.greetingDot} />
          <Text style={styles.greetingText}>{greeting}</Text>
        </Animated.View>
      )}

      {/* 3 core buttons */}
      <View style={styles.actions}>
        {/* Add Product — left */}
        <TouchableOpacity
          style={[styles.sideButton]}
          onPress={() => router.push('/(app)/products')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={30} color={colors.green} />
          <Text style={styles.sideButtonLabel}>
            {tl ? 'Produkto' : 'Products'}
          </Text>
        </TouchableOpacity>

        {/* Checkout — center, big */}
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={() => router.push('/(app)/checkout')}
          activeOpacity={0.85}
        >
          <Ionicons name="cart" size={36} color={colors.dark} />
          <Text style={styles.checkoutLabel}>
            {tl ? 'Checkout' : 'Checkout'}
          </Text>
        </TouchableOpacity>

        {/* Chat — right */}
        <TouchableOpacity
          style={[styles.sideButton]}
          onPress={() => router.push('/(app)/chat')}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={30} color={colors.green} />
          <Text style={styles.sideButtonLabel}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Milestone celebration */}
      <MilestoneModal
        milestoneKey={pendingMilestone}
        language={language}
        onDismiss={() => setPendingMilestone(null)}
      />

      {/* Side menu modal */}
      <Modal
        transparent
        visible={menuOpen}
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <Text style={styles.menuStoreName}>{auth?.storeName}</Text>
            <View style={styles.menuDivider} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.route + item.label}
                  style={styles.menuItem}
                  onPress={() => { setMenuOpen(false); router.push(item.route as any) }}
                >
                  <Ionicons name={item.icon as any} size={20} color={colors.grey} />
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#D94F4F" />
              <Text style={[styles.menuItemLabel, { color: '#D94F4F' }]}>
                {tl ? 'Mag-logout' : 'Log out'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  storeName: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 22,
    color: colors.pale,
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#0D1F1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A3530',
    padding: 16,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  greetingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    marginTop: 5,
    flexShrink: 0,
  },
  greetingText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.pale,
    lineHeight: 22,
    flex: 1,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  sideButton: {
    flex: 1,
    backgroundColor: '#0D1F1A',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1A3530',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  sideButtonLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: colors.pale,
    textAlign: 'center',
  },
  checkoutButton: {
    flex: 1.6,
    backgroundColor: colors.green,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  checkoutLabel: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 18,
    color: colors.dark,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7,24,18,0.6)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#0D1F1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    maxHeight: '80%',
  },
  menuStoreName: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 18,
    color: colors.pale,
    marginBottom: 16,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#1A3530',
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  menuItemLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: colors.pale,
  },
})
