import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Screen } from '../../../src/components/ui/Screen'
import { Button } from '../../../src/components/ui/Button'
import { StockBadge } from '../../../src/components/ui/StockBadge'
import { MilestoneModal } from '../../../src/components/ui/MilestoneModal'
import { useAppStore, useAuth, useLanguage, useCart, useCartTotal, useCartCount } from '../../../src/lib/store'
import { api } from '../../../src/lib/api'
import { colors } from '../../../src/constants/theme'
import type { Product, CartItem } from '@litro/types'

type PaymentMethod = 'cash' | 'gcash' | 'card' | 'credit'

export default function CheckoutScreen() {
  const auth = useAuth()
  const language = useLanguage()
  const tl = language === 'tl'
  const cart = useCart()
  const total = useCartTotal()
  const cartCount = useCartCount()
  const { addToCart, setItemQuantity, clearCart, setPendingMilestone, pendingMilestone } = useAppStore()
  const queryClient = useQueryClient()

  const [cartExpanded, setCartExpanded] = useState(false)
  const [paymentSheet, setPaymentSheet] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ─── Fetch products ──────────────────────────────────────────────────────

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', auth?.storeId],
    queryFn: () => api.get<Product[]>('/products'),
    enabled: !!auth?.storeId,
  })

  // ─── Cart helpers ────────────────────────────────────────────────────────

  const getCartQty = (productId: string) =>
    cart.find((i) => i.productId === productId)?.quantity ?? 0

  const handleAddProduct = (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    addToCart({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: 1,
      subtotal: product.price,
    })
  }

  const handleAdjustQty = (productId: string, delta: number) => {
    const current = getCartQty(productId)
    setItemQuantity(productId, current + delta)
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedPayment) return
    setSubmitting(true)
    try {
      await api.post('/transactions', {
        items: cart,
        paymentMethod: selectedPayment,
        channel: 'app',
      })
      // Check first sale milestone
      const allTxns = queryClient.getQueryData<any[]>(['transactions']) ?? []
      const isFirstSale = allTxns.length === 0
      clearCart()
      setPaymentSheet(false)
      setSelectedPayment(null)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      if (isFirstSale) setPendingMilestone('first_sale')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert(
        tl ? 'Hindi natanggap' : 'Not submitted',
        tl ? 'Subukan ulit.' : 'Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render product card ─────────────────────────────────────────────────

  const renderProduct = useCallback(({ item }: { item: Product }) => {
    const qty = getCartQty(item.id)
    const inCart = qty > 0

    return (
      <TouchableOpacity
        style={[styles.productCard, inCart && styles.productCardActive]}
        onPress={() => handleAddProduct(item)}
        activeOpacity={0.8}
      >
        <View style={styles.productCardHeader}>
          <StockBadge color={item.stockColor as any} size={7} />
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        </View>
        <Text style={styles.productPrice}>₱{item.price}</Text>

        {/* Quantity controls — only show when in cart */}
        {inCart && (
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => handleAdjustQty(item.id, -1)}
              hitSlop={8}
            >
              <Ionicons name="remove" size={16} color={colors.green} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => handleAdjustQty(item.id, 1)}
              hitSlop={8}
            >
              <Ionicons name="add" size={16} color={colors.green} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    )
  }, [cart])

  // ─── Payment method options ──────────────────────────────────────────────

  const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: string }[] = [
    { method: 'cash', label: tl ? 'Cash' : 'Cash', icon: 'cash-outline' },
    { method: 'gcash', label: 'GCash', icon: 'phone-portrait-outline' },
    { method: 'card', label: tl ? 'Card' : 'Card', icon: 'card-outline' },
    { method: 'credit', label: tl ? 'Credit (Tab)' : 'Credit (Tab)', icon: 'document-text-outline' },
  ]

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.pale} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tl ? 'Checkout' : 'Checkout'}</Text>
        {cartCount > 0 && (
          <TouchableOpacity onPress={clearCart} hitSlop={12}>
            <Text style={styles.clearText}>{tl ? 'I-clear' : 'Clear'}</Text>
          </TouchableOpacity>
        )}
        {cartCount === 0 && <View style={{ width: 48 }} />}
      </View>

      {/* Product grid */}
      {isLoading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator color={colors.green} size="large" />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyArea}>
          <Text style={styles.emptyText}>
            {tl
              ? 'Wala pang produkto. Magdagdag muna sa Products.'
              : 'No products yet. Add some in Products.'}
          </Text>
          <Button
            label={tl ? 'Magdagdag ng produkto' : 'Add a product'}
            onPress={() => router.push('/(app)/products')}
            variant="secondary"
            style={{ marginTop: 16 }}
          />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          extraData={cart}
        />
      )}

      {/* Cart bar — sticky bottom */}
      {cartCount > 0 && (
        <View style={styles.cartBar}>
          <TouchableOpacity
            style={styles.cartSummary}
            onPress={() => setCartExpanded(true)}
            activeOpacity={0.8}
          >
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
            <Text style={styles.cartSummaryText}>
              {tl ? `${cart.length} item${cart.length > 1 ? 's' : ''}` : `${cart.length} item${cart.length > 1 ? 's' : ''}`}
            </Text>
            <Text style={styles.cartTotal}>₱{total}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => setPaymentSheet(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.submitLabel}>{tl ? 'I-submit' : 'Submit'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cart detail modal */}
      <Modal
        transparent
        visible={cartExpanded}
        animationType="slide"
        onRequestClose={() => setCartExpanded(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setCartExpanded(false)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{tl ? 'Cart' : 'Cart'}</Text>
            {cart.map((item) => (
              <View key={item.productId} style={styles.cartItem}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.productName}</Text>
                <View style={styles.cartItemRight}>
                  <TouchableOpacity onPress={() => handleAdjustQty(item.productId!, -1)} hitSlop={8}>
                    <Ionicons name="remove-circle-outline" size={22} color={colors.grey} />
                  </TouchableOpacity>
                  <Text style={styles.cartItemQty}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => handleAdjustQty(item.productId!, 1)} hitSlop={8}>
                    <Ionicons name="add-circle-outline" size={22} color={colors.green} />
                  </TouchableOpacity>
                  <Text style={styles.cartItemSubtotal}>₱{item.subtotal}</Text>
                </View>
              </View>
            ))}
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>Total</Text>
              <Text style={styles.cartTotalValue}>₱{total}</Text>
            </View>
            <Button
              label={tl ? 'I-submit' : 'Submit'}
              onPress={() => { setCartExpanded(false); setPaymentSheet(true) }}
              fullWidth
              size="lg"
              style={{ marginTop: 8 }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Payment method sheet */}
      <Modal
        transparent
        visible={paymentSheet}
        animationType="slide"
        onRequestClose={() => setPaymentSheet(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setPaymentSheet(false)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {tl ? `Total: ₱${total}` : `Total: ₱${total}`}
            </Text>
            <Text style={styles.sheetSub}>
              {tl ? 'Anong payment method?' : 'Payment method?'}
            </Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.method}
                  style={[
                    styles.paymentOption,
                    selectedPayment === opt.method && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setSelectedPayment(opt.method)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={24}
                    color={selectedPayment === opt.method ? colors.dark : colors.pale}
                  />
                  <Text
                    style={[
                      styles.paymentLabel,
                      selectedPayment === opt.method && styles.paymentLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              label={tl ? 'Kumpirmahin' : 'Confirm order'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={!selectedPayment}
              fullWidth
              size="lg"
              style={{ marginTop: 8 }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Milestone */}
      <MilestoneModal
        milestoneKey={pendingMilestone}
        language={language}
        onDismiss={() => setPendingMilestone(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 20,
    color: colors.pale,
  },
  clearText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: colors.grey,
  },

  // Grid
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontFamily: 'DMSans-Regular', fontSize: 16, color: colors.grey, textAlign: 'center', lineHeight: 24 },
  grid: { paddingHorizontal: 16, paddingBottom: 120 },
  gridRow: { gap: 12, marginBottom: 12 },

  productCard: {
    flex: 1,
    backgroundColor: '#0D1F1A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1A3530',
    padding: 16,
    gap: 6,
    minHeight: 100,
  },
  productCardActive: {
    borderColor: colors.green,
    backgroundColor: '#0D2B20',
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  productName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: colors.pale,
    flex: 1,
    lineHeight: 20,
  },
  productPrice: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 18,
    color: colors.green,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 16,
    color: colors.pale,
    minWidth: 20,
    textAlign: 'center',
  },

  // Cart bar
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: colors.dark,
    borderTopWidth: 1,
    borderTopColor: '#1A3530',
  },
  cartSummary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D1F1A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1A3530',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cartBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.dark },
  cartSummaryText: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.grey, flex: 1 },
  cartTotal: { fontFamily: 'BricolageGrotesque-Bold', fontSize: 16, color: colors.pale },
  submitButton: {
    backgroundColor: colors.green,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: { fontFamily: 'BricolageGrotesque-Bold', fontSize: 16, color: colors.dark },

  // Sheets
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(7,24,18,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0D1F1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    gap: 12,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#1A3530', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontFamily: 'BricolageGrotesque-Bold', fontSize: 22, color: colors.pale },
  sheetSub: { fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.grey },

  // Cart detail
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1A3530' },
  cartItemName: { fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.pale, flex: 1 },
  cartItemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartItemQty: { fontFamily: 'BricolageGrotesque-Bold', fontSize: 16, color: colors.pale, minWidth: 20, textAlign: 'center' },
  cartItemSubtotal: { fontFamily: 'BricolageGrotesque-Bold', fontSize: 15, color: colors.green, minWidth: 60, textAlign: 'right' },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  cartTotalLabel: { fontFamily: 'DMSans-Medium', fontSize: 16, color: colors.grey },
  cartTotalValue: { fontFamily: 'BricolageGrotesque-Bold', fontSize: 24, color: colors.pale },

  // Payment
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paymentOption: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#071812',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1A3530',
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  paymentOptionSelected: { backgroundColor: colors.green, borderColor: colors.green },
  paymentLabel: { fontFamily: 'DMSans-Medium', fontSize: 14, color: colors.pale },
  paymentLabelSelected: { color: colors.dark },
})
