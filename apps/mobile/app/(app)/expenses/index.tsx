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
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
import type { Expense } from '@litro/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export default function ExpensesScreen() {
  const language = useLanguage()
  const tl = language === 'tl'
  const queryClient = useQueryClient()

  const [addOpen, setAddOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => api.get<Expense[]>('/expenses'),
  })

  const addMutation = useMutation({
    mutationFn: (body: object) => api.post('/expenses', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setAddOpen(false)
      setDescription('')
      setAmount('')
      setErrors({})
    },
    onError: (err: any) => {
      setErrors({ general: err?.message ?? (tl ? 'May error.' : 'Something went wrong.') })
    },
  })

  const handleAdd = () => {
    const e: Record<string, string> = {}
    if (!description.trim()) e.description = tl ? 'Ilagay ang paglalarawan.' : 'Enter description.'
    const a = parseFloat(amount)
    if (!amount || isNaN(a) || a <= 0) e.amount = tl ? 'Ilagay ang tamang halaga.' : 'Enter a valid amount.'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    addMutation.mutate({ description: description.trim(), amount: a })
  }

  const totalToday = expenses
    .filter((e) => {
      const d = new Date(e.createdAt)
      const now = new Date()
      return d.toDateString() === now.toDateString()
    })
    .reduce((sum, e) => sum + e.amount, 0)

  const renderItem = ({ item }: { item: Expense }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
        <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.cardAmount}>₱{item.amount.toFixed(2)}</Text>
    </View>
  )

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.pale} />
        </TouchableOpacity>
        <Text style={styles.title}>{tl ? 'Mga Gastos' : 'Expenses'}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddOpen(true)}
          hitSlop={12}
        >
          <Ionicons name="add" size={24} color={colors.dark} />
        </TouchableOpacity>
      </View>

      {/* Today summary */}
      {totalToday > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{tl ? 'Gastos ngayon' : 'Today\'s expenses'}</Text>
          <Text style={styles.summaryTotal}>₱{totalToday.toFixed(2)}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : expenses.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>
            {tl ? 'Wala pang gastos.' : 'No expenses yet.'}
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setAddOpen(true)}>
            <Text style={styles.emptyBtnLabel}>
              {tl ? '+ Magdagdag ng gastos' : '+ Add expense'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add expense modal */}
      <Modal
        transparent
        visible={addOpen}
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.overlay} onPress={() => setAddOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>
                {tl ? 'Bagong gastos' : 'New expense'}
              </Text>
              <View style={styles.sheetFields}>
                <Input
                  label={tl ? 'Paglalarawan' : 'Description'}
                  value={description}
                  onChangeText={(t) => { setDescription(t); setErrors({}) }}
                  placeholder={tl ? 'hal. Kuryente' : 'e.g. Electricity'}
                  autoFocus
                  returnKeyType="next"
                  error={errors.description}
                />
                <Input
                  label={tl ? 'Halaga (₱)' : 'Amount (₱)'}
                  value={amount}
                  onChangeText={(t) => { setAmount(t); setErrors({}) }}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleAdd}
                  error={errors.amount}
                />
                {errors.general ? (
                  <Text style={styles.errorGeneral}>{errors.general}</Text>
                ) : null}
              </View>
              <Button
                label={tl ? 'I-save' : 'Save'}
                onPress={handleAdd}
                loading={addMutation.isPending}
                disabled={!description.trim() || !amount.trim()}
                fullWidth
                size="lg"
              />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
  addBtn: {
    backgroundColor: colors.green,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#D94F4F',
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
  cardLeft: { flex: 1, gap: 3, marginRight: 12 },
  cardDesc: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.pale,
  },
  cardDate: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
  },
  cardAmount: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 16,
    color: '#D94F4F',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  empty: { fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.grey },
  emptyBtn: {
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyBtnLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.dark,
  },
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
    gap: 20,
  },
  sheetTitle: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 20,
    color: colors.pale,
  },
  sheetFields: { gap: 16 },
  errorGeneral: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#D94F4F',
    textAlign: 'center',
  },
})
