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
import { Input } from '../../../src/components/ui/Input'
import { Button } from '../../../src/components/ui/Button'
import { api } from '../../../src/lib/api'
import { useLanguage } from '../../../src/lib/store'
import { colors } from '../../../src/constants/theme'
import type { CreditCustomer } from '@litro/types'

interface CustomerWithBalance extends CreditCustomer {
  balance: number
}

export default function CreditsScreen() {
  const language = useLanguage()
  const tl = language === 'tl'
  const queryClient = useQueryClient()

  const [selected, setSelected] = useState<CustomerWithBalance | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payError, setPayError] = useState('')

  const { data: customers = [], isLoading } = useQuery<CustomerWithBalance[]>({
    queryKey: ['credits'],
    queryFn: () => api.get<CustomerWithBalance[]>('/credits'),
  })

  const payMutation = useMutation({
    mutationFn: ({ customerId, amount }: { customerId: string; amount: number }) =>
      api.post('/credits/payment', { customerId, amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] })
      setPayAmount('')
      setPayError('')
      setSelected(null)
    },
    onError: (err: any) => {
      setPayError(err?.message ?? (tl ? 'May error.' : 'Something went wrong.'))
    },
  })

  const handlePay = () => {
    const a = parseFloat(payAmount)
    if (!payAmount || isNaN(a) || a <= 0) {
      setPayError(tl ? 'Ilagay ang tamang halaga.' : 'Enter a valid amount.')
      return
    }
    if (selected && a > selected.balance) {
      setPayError(tl ? 'Mas mataas pa sa utang.' : 'Exceeds balance.')
      return
    }
    if (selected) {
      payMutation.mutate({ customerId: selected.id, amount: a })
    }
  }

  const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0)

  const renderItem = ({ item }: { item: CustomerWithBalance }) => (
    <TouchableOpacity
      style={[styles.card, item.balance === 0 && styles.cardSettled]}
      onPress={() => { setSelected(item); setPayAmount(''); setPayError('') }}
      activeOpacity={0.75}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.cardName}>{item.name}</Text>
        {item.balance === 0 && (
          <Text style={styles.settledTag}>{tl ? 'Bayad na' : 'Settled'}</Text>
        )}
      </View>
      <Text style={[styles.cardBalance, item.balance === 0 && styles.cardBalanceSettled]}>
        ₱{item.balance.toFixed(2)}
      </Text>
    </TouchableOpacity>
  )

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.pale} />
        </TouchableOpacity>
        <Text style={styles.title}>{tl ? 'Mga May Tab' : 'Credits'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {totalBalance > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{tl ? 'Kabuuang utang' : 'Total outstanding'}</Text>
          <Text style={styles.summaryTotal}>₱{totalBalance.toFixed(2)}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>
            {tl ? 'Wala pang nag-credit.' : 'No credit customers yet.'}
          </Text>
          <Text style={styles.emptySub}>
            {tl
              ? 'Kapag nagbenta ka ng credit sa checkout, lalabas dito ang pangalan ng customer.'
              : 'When you make a credit sale in checkout, customers will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Customer detail / payment modal */}
      <Modal
        transparent
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{selected.name}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Ionicons name="close" size={22} color={colors.grey} />
                  </TouchableOpacity>
                </View>

                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{tl ? 'Utang' : 'Balance'}</Text>
                  <Text style={[styles.balanceValue, selected.balance === 0 && styles.balanceValueZero]}>
                    ₱{selected.balance.toFixed(2)}
                  </Text>
                </View>

                {selected.balance > 0 && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.payLabel}>
                      {tl ? 'Magbayad' : 'Record payment'}
                    </Text>
                    <View style={styles.payRow}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label=""
                          value={payAmount}
                          onChangeText={(t) => { setPayAmount(t); setPayError('') }}
                          placeholder={`₱${selected.balance.toFixed(2)}`}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          onSubmitEditing={handlePay}
                          error={payError}
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.fullBtn}
                        onPress={() => {
                          setPayAmount(selected.balance.toFixed(2))
                          setPayError('')
                        }}
                      >
                        <Text style={styles.fullBtnLabel}>{tl ? 'Buong utang' : 'Full'}</Text>
                      </TouchableOpacity>
                    </View>

                    <Button
                      label={tl ? 'I-record ang bayad' : 'Record payment'}
                      onPress={handlePay}
                      loading={payMutation.isPending}
                      disabled={!payAmount.trim()}
                      fullWidth
                      size="lg"
                    />
                  </>
                )}

                {selected.balance === 0 && (
                  <View style={styles.settledBanner}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                    <Text style={styles.settledBannerText}>
                      {tl ? 'Bayad na ang lahat ng utang!' : 'All credits settled!'}
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
  summary: {
    backgroundColor: '#0D1F1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1A3530',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.grey,
  },
  summaryTotal: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 20,
    color: '#F59E0B',
  },
  list: { gap: 10, paddingBottom: 32 },
  card: {
    backgroundColor: '#0D1F1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1A3530',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSettled: { opacity: 0.55 },
  cardLeft: { flex: 1, gap: 2 },
  cardName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: colors.pale,
  },
  settledTag: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: colors.green,
  },
  cardBalance: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 16,
    color: '#F59E0B',
  },
  cardBalanceSettled: { color: colors.grey },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  empty: { fontFamily: 'DMSans-Medium', fontSize: 15, color: colors.grey, textAlign: 'center' },
  emptySub: { fontFamily: 'DMSans-Regular', fontSize: 13, color: '#2A4A40', textAlign: 'center' },
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
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 20,
    color: colors.pale,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  balanceLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.grey,
  },
  balanceValue: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 28,
    color: '#F59E0B',
  },
  balanceValueZero: { color: colors.green },
  divider: { height: 1, backgroundColor: '#1A3530', marginVertical: 16 },
  payLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: colors.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  payRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 16 },
  fullBtn: {
    backgroundColor: '#1A3530',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 2,
  },
  fullBtnLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: colors.pale,
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: 'rgba(26,138,111,0.1)',
    borderRadius: 10,
    padding: 14,
  },
  settledBannerText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.green,
  },
})
