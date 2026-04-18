import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Screen } from '../../../src/components/ui/Screen'
import { Input } from '../../../src/components/ui/Input'
import { Button } from '../../../src/components/ui/Button'
import { api } from '../../../src/lib/api'
import { useLanguage } from '../../../src/lib/store'
import { colors } from '../../../src/constants/theme'
import type { Product } from '@litro/types'

type StockMode = 'numerical' | 'descriptive' | 'none'

export default function AddProductScreen() {
  const language = useLanguage()
  const tl = language === 'tl'
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stockMode, setStockMode] = useState<StockMode>('numerical')
  const [quantity, setQuantity] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: (body: object) => api.post<Product>('/products', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.back()
    },
    onError: (err: any) => {
      setErrors({ general: err?.message ?? (tl ? 'May error.' : 'Something went wrong.') })
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = tl ? 'Ilagay ang pangalan.' : 'Enter a name.'
    const p = parseFloat(price)
    if (!price || isNaN(p) || p < 0) e.price = tl ? 'Ilagay ang tamang presyo.' : 'Enter a valid price.'
    if (stockMode === 'numerical') {
      const q = parseInt(quantity)
      if (!quantity || isNaN(q) || q < 0) e.quantity = tl ? 'Ilagay ang dami.' : 'Enter quantity.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    const body: Record<string, unknown> = {
      name: name.trim(),
      price: parseFloat(price),
      stockMode,
    }
    if (stockMode === 'numerical') {
      body.quantity = parseInt(quantity)
    }
    mutation.mutate(body)
  }

  const STOCK_MODES: { value: StockMode; label: string; sub: string }[] = [
    {
      value: 'numerical',
      label: tl ? 'Bilangin' : 'Count stock',
      sub: tl ? 'May bilang na natitira (hal. 50 bote)' : 'Track exact quantity (e.g. 50 bottles)',
    },
    {
      value: 'descriptive',
      label: tl ? 'Madami / Kaunti / Wala' : 'Plenty / Low / Out',
      sub: tl ? 'Para sa sako, galon, bulk' : 'For sacks, gallons, bulk items',
    },
    {
      value: 'none',
      label: tl ? 'Huwag bantayan' : 'Don\'t track',
      sub: tl ? 'Para sa mga serbisyo o luto' : 'For services or cooked food',
    },
  ]

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>{tl ? 'Kanselahin' : 'Cancel'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{tl ? 'Bagong Produkto' : 'New Product'}</Text>
          <View style={{ width: 72 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.fields}>
            <Input
              label={tl ? 'Pangalan ng produkto' : 'Product name'}
              value={name}
              onChangeText={(t) => { setName(t); setErrors({}) }}
              placeholder={tl ? 'hal. Coke 1.5L' : 'e.g. Coke 1.5L'}
              autoFocus
              returnKeyType="next"
              error={errors.name}
            />

            <Input
              label={tl ? 'Presyo (₱)' : 'Price (₱)'}
              value={price}
              onChangeText={(t) => { setPrice(t); setErrors({}) }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              returnKeyType="next"
              error={errors.price}
            />

            {/* Stock mode picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {tl ? 'Paraan ng pagbabantay ng stock' : 'Stock tracking'}
              </Text>
              {STOCK_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode.value}
                  style={[styles.modeCard, stockMode === mode.value && styles.modeCardActive]}
                  onPress={() => { setStockMode(mode.value); setErrors({}) }}
                  activeOpacity={0.75}
                >
                  <View style={styles.modeRow}>
                    <View style={[styles.radio, stockMode === mode.value && styles.radioActive]} />
                    <View style={styles.modeText}>
                      <Text style={[styles.modeLabel, stockMode === mode.value && styles.modeLabelActive]}>
                        {mode.label}
                      </Text>
                      <Text style={styles.modeSub}>{mode.sub}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {stockMode === 'numerical' && (
              <Input
                label={tl ? 'Kasalukuyang dami' : 'Current quantity'}
                value={quantity}
                onChangeText={(t) => { setQuantity(t); setErrors({}) }}
                placeholder="0"
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                error={errors.quantity}
              />
            )}

            {errors.general ? (
              <Text style={styles.errorGeneral}>{errors.general}</Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={tl ? 'I-save' : 'Save product'}
            onPress={handleSave}
            loading={mutation.isPending}
            disabled={!name.trim() || !price.trim()}
            fullWidth
            size="lg"
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 16,
  },
  cancel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.grey,
    width: 72,
  },
  title: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 18,
    color: colors.pale,
  },
  fields: { gap: 20, paddingBottom: 8 },
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: colors.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeCard: {
    backgroundColor: '#0D1F1A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1A3530',
    padding: 14,
  },
  modeCardActive: {
    borderColor: colors.green,
    backgroundColor: '#0A2920',
  },
  modeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#2A4A40',
    marginTop: 2,
  },
  radioActive: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  modeText: { flex: 1, gap: 2 },
  modeLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: colors.pale,
  },
  modeLabelActive: { color: colors.green },
  modeSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
  },
  errorGeneral: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#D94F4F',
    textAlign: 'center',
  },
  footer: { paddingTop: 16, paddingBottom: 32 },
})
