import { useEffect, useRef } from 'react'
import { Modal, View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import type { MilestoneKey } from '@litro/types'
import { colors } from '../../constants/theme'

const MILESTONE_CONFIG: Record<MilestoneKey, { emoji: string; tl: string; en: string }> = {
  store_created: {
    emoji: '🏪',
    tl: 'Nabuo na ang tindahan mo!\nSimula na ng bagong kabanata.',
    en: "Your store is live!\nA new chapter begins.",
  },
  first_product: {
    emoji: '📦',
    tl: 'Unang produkto!\nIkaw na ang boss.',
    en: 'First product added!\nYou\'re in business.',
  },
  first_sale: {
    emoji: '💰',
    tl: 'UNANG BENTA!\nIto na ang simula ng lahat.',
    en: 'FIRST SALE!\nThis is where it all begins.',
  },
  first_low_stock: {
    emoji: '📊',
    tl: 'Mababa na ang stock!\nPanahon na mag-restock.',
    en: 'Low stock alert!\nTime to restock.',
  },
  streak_7_days: {
    emoji: '🔥',
    tl: '7 araw na sunud-sunod!\nHindi ka titigil.',
    en: '7-day streak!\nYou\'re unstoppable.',
  },
  milestone_30_days: {
    emoji: '🌟',
    tl: 'Isang buwan na!\nAnong laking nagawa mo.',
    en: 'One month in!\nLook how far you\'ve come.',
  },
}

interface MilestoneModalProps {
  milestoneKey: MilestoneKey | null
  language: 'tl' | 'en'
  onDismiss: () => void
}

export function MilestoneModal({ milestoneKey, language, onDismiss }: MilestoneModalProps) {
  const scale = useRef(new Animated.Value(0.5)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!milestoneKey) return
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 150 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [milestoneKey])

  if (!milestoneKey) return null
  const config = MILESTONE_CONFIG[milestoneKey]

  return (
    <Modal transparent animationType="none" visible={!!milestoneKey} onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <Text style={styles.emoji}>{config.emoji}</Text>
          <Text style={styles.text}>{language === 'tl' ? config.tl : config.en}</Text>
          <Text style={styles.hint}>
            {language === 'tl' ? 'Pindutin para ituloy' : 'Tap to continue'}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7,24,18,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#0D1F1A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.green,
    padding: 40,
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  emoji: {
    fontSize: 72,
    lineHeight: 88,
  },
  text: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 22,
    color: colors.pale,
    textAlign: 'center',
    lineHeight: 32,
  },
  hint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
    marginTop: 8,
  },
})
