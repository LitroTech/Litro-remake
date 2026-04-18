import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../../../src/components/ui/Screen'
import { api } from '../../../src/lib/api'
import { useAuth, useLanguage } from '../../../src/lib/store'
import { colors } from '../../../src/constants/theme'
import type { Transaction } from '@litro/types'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  card: 'Card',
  credit: 'Credit',
}

const METHOD_COLORS: Record<string, string> = {
  cash: '#1A8A6F',
  gcash: '#3B82F6',
  card: '#8B5CF6',
  credit: '#F59E0B',
}

function formatDate(iso: string, lang: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryScreen() {
  const language = useLanguage()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const tl = language === 'tl'
  const isOwner = auth?.role === 'owner'

  const [selected, setSelected] = useState<Transaction | null>(null)

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => api.get<Transaction[]>('/transactions'),
  })

  const voidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/transactions/${id}/void`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setSelected(null)
    },
  })

  const active = transactions.filter((t) => !t.voidedAt)
  const voided = transactions.filter((t) => t.voidedAt)

  const renderItem = ({ item }: { item: Transaction }) => {
    const isVoided = !!item.voidedAt
    return (
      <TouchableOpacity
        style={[styles.card, isVoided && styles.cardVoided]}
        onPress={() => setSelected(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardLeft}>
          <Text style={[styles.cardDate, isVoided && styles.textMuted]}>
            {formatDate(item.createdAt, language)}
          </Text>
          <Text style={[styles.cardItems, isVoided && styles.textMuted]}>
            {item.items?.length ?? 0} {tl ? 'item' : 'item(s)'}
            {isVoided && (
              <Text style={styles.voidedTag}> · {tl ? 'Na-void' : 'Voided'}</Text>
            )}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.cardTotal, isVoided && styles.textMuted]}>
            ₱{item.total.toFixed(2)}
          </Text>
          <View style={[
            styles.methodBadge,
            { backgroundColor: METHOD_COLORS[item.paymentMethod] ?? colors.grey }
          ]}>
            <Text style={styles.methodLabel}>
              {METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.pale} />
        </TouchableOpacity>
        <Text style={styles.title}>{tl ? 'Kasaysayan' : 'History'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>
            {tl ? 'Wala pang transaksyon.' : 'No transactions yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...active, ...voided]}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail modal */}
      <Modal
        transparent
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>
                    {tl ? 'Detalye ng transaksyon' : 'Transaction detail'}
                  </Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Ionicons name="close" size={22} color={colors.grey} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.sheetDate}>
                  {formatDate(selected.createdAt, language)}
                </Text>

                <View style={styles.divider} />

                {(selected.items ?? []).map((item, i) => (
                  <View key={i} style={styles.lineItem}>
                    <Text style={styles.lineItemName} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <Text style={styles.lineItemQty}>×{item.quantity}</Text>
                    <Text style={styles.lineItemTotal}>
                      ₱{(item.unitPrice * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                ))}

                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₱{selected.total.toFixed(2)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {tl ? 'Paraan ng bayad' : 'Payment'}
                  </Text>
                  <Text style={styles.totalValue}>
                    {METHOD_LABELS[selected.paymentMethod] ?? selected.paymentMethod}
                  </Text>
                </View>

                {!selected.voidedAt && isOwner && (
                  <TouchableOpacity
                    style={styles.voidBtn}
                    onPress={() => voidMutation.mutate(selected.id)}
                    disabled={voidMutation.isPending}
                  >
                    <Text style={styles.voidBtnLabel}>
                      {voidMutation.isPending
                        ? (tl ? 'Ino-void...' : 'Voiding...')
                        : (tl ? 'I-void ang transaksyon' : 'Void transaction')}
                    </Text>
                  </TouchableOpacity>
                )}

                {selected.voidedAt && (
                  <View style={styles.voidedBanner}>
                    <Text style={styles.voidedBannerText}>
                      {tl ? 'Na-void na ang transaksyong ito.' : 'This transaction was voided.'}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
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
  list: { paddingBottom: 32, gap: 10 },
  card: {
    backgroundColor: '#0D1F1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1A3530',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardVoided: { opacity: 0.55 },
  cardLeft: { gap: 3 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardDate: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
  },
  cardItems: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.pale,
  },
  cardTotal: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 16,
    color: colors.pale,
  },
  textMuted: { color: colors.grey },
  voidedTag: { color: '#D94F4F' },
  methodBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  methodLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    color: '#fff',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.grey },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7,24,18,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0D1F1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 18,
    color: colors.pale,
  },
  sheetDate: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
    marginBottom: 16,
  },
  divider: { height: 1, backgroundColor: '#1A3530', marginVertical: 12 },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  lineItemName: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.pale,
  },
  lineItemQty: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.grey,
    width: 32,
    textAlign: 'right',
  },
  lineItemTotal: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.pale,
    width: 72,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.grey,
  },
  totalValue: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.pale,
  },
  voidBtn: {
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D94F4F',
    paddingVertical: 14,
    alignItems: 'center',
  },
  voidBtnLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#D94F4F',
  },
  voidedBanner: {
    marginTop: 20,
    backgroundColor: 'rgba(217,79,79,0.1)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  voidedBannerText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#D94F4F',
  },
})
