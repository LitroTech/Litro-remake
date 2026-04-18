import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Screen } from '../../../src/components/ui/Screen'
import { Input } from '../../../src/components/ui/Input'
import { Button } from '../../../src/components/ui/Button'
import { api } from '../../../src/lib/api'
import { useLanguage } from '../../../src/lib/store'
import { colors } from '../../../src/constants/theme'
import type { Product } from '@litro/types'

type StockMode = 'numerical' | 'descriptive' | 'none'

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const language = useLanguage()
  const tl = language === 'tl'
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stockMode, setStockMode] = useState<StockMode>('numerical')
  const [quantity, setQuantity] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: !!id,
  })

  useEffect(() => {
    if (product) {
      setName(product.name)
      setPrice(String(product.price))
      setStockMode((product.stockMode ?? 'none') as StockMode)
      setQuantity(product.quantity != null ? String(product.quantity) : '')
    }
  }, [product])

  const updateMutation = useMutation({
    mutationFn: (body: object) => api.patch<Product>(`/products/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', id] })
      router.back()
    },
    onError: (err: any) => {
      setErrors({ general: err?.message ?? (tl ? 'May error.' : 'Something went wrong.') })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.back()
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
    updateMutation.mutate(body)
  }

  const confirmDelete = () => {
    Alert.alert(
      tl ? 'Burahin ang produkto?' : 'Delete product?',
      tl
        ? `Permanenteng mabubura si "${name}". Hindi na ito mababawi.`
        : `"${name}" will be permanently deleted. This can't be undone.`,
      [
        { text: tl ? 'Kanselahin' : 'Cancel', style: 'cancel' },
        {
          text: tl ? 'Burahin' : 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    )
  }

  const STOCK_MODES: { value: StockMode; label: string }[] = [
    { value: 'numerical', label: tl ? 'Bilangin' : 'Count stock' },
    { value: 'descriptive', label: tl ? 'Madami/Kaunti/Wala' : 'Plenty/Low/Out' },
    { value: 'none', label: tl ? 'Huwag bantayan' : "Don't track" },
  ]

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      </Screen>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>{tl ? 'Kanselahin' : 'Cancel'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{tl ? 'I-edit ang Produkto' : 'Edit Product'}</Text>
          <TouchableOpacity onPress={confirmDelete} hitSlop={12}>
            <Text style={styles.deleteText}>{tl ? 'Burahin' : 'Delete'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.fields}>
            <Input
              label={tl ? 'Pangalan ng produkto' : 'Product name'}
              value={name}
              onChangeText={(t) => { setName(t); setErrors({}) }}
              returnKeyType="next"
              error={errors.name}
            />

            <Input
              label={tl ? 'Presyo (₱)' : 'Price (₱)'}
              value={price}
              onChangeText={(t) => { setPrice(t); setErrors({}) }}
              keyboardType="decimal-pad"
              returnKeyType="next"
              error={errors.price}
            />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {tl ? 'Paraan ng stock' : 'Stock tracking'}
              </Text>
              <View style={styles.modeRow}>
                {STOCK_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode.value}
                    style={[styles.modeChip, stockMode === mode.value && styles.modeChipActive]}
                    onPress={() => { setStockMode(mode.value); setErrors({}) }}
                  >
                    <Text style={[styles.modeChipLabel, stockMode === mode.value && styles.modeChipLabelActive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {stockMode === 'numerical' && (
              <Input
                label={tl ? 'Kasalukuyang dami' : 'Current quantity'}
                value={quantity}
                onChangeText={(t) => { setQuantity(t); setErrors({}) }}
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
            label={tl ? 'I-save ang pagbabago' : 'Save changes'}
            onPress={handleSave}
            loading={updateMutation.isPending}
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
  deleteText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#D94F4F',
    width: 72,
    textAlign: 'right',
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
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1A3530',
    backgroundColor: '#0D1F1A',
  },
  modeChipActive: {
    borderColor: colors.green,
    backgroundColor: '#0A2920',
  },
  modeChipLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: colors.grey,
  },
  modeChipLabelActive: {
    color: colors.green,
    fontFamily: 'DMSans-Medium',
  },
  errorGeneral: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#D94F4F',
    textAlign: 'center',
  },
  footer: { paddingTop: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
