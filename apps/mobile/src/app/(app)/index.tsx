import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../constants/theme';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { ProductCard } from '../../components/ProductCard';
import type { CreditCustomer, PaymentMethod, Product } from '@litro/types';

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Cash', icon: 'cash-outline' },
  { key: 'gcash', label: 'GCash', icon: 'phone-portrait-outline' },
  { key: 'card', label: 'Card', icon: 'card-outline' },
  { key: 'credit', label: 'Credit', icon: 'person-outline' },
];

export default function POSScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { cart, addToCart, clearCart } = useAppStore();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const { data: creditCustomers = [] } = useQuery({
    queryKey: ['credit-customers'],
    queryFn: () => api.get<CreditCustomer[]>('/credits'),
    enabled: checkoutVisible && paymentMethod === 'credit',
  });

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const cartTotal = cart.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const filteredCustomers = creditCustomers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const canSubmit =
    paymentMethod !== null &&
    (paymentMethod !== 'credit' || selectedCustomer !== null);

  function openCheckout() {
    setPaymentMethod(null);
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCheckoutVisible(true);
  }

  function closeCheckout() {
    setCheckoutVisible(false);
  }

  async function handleConfirm() {
    if (!paymentMethod) return;
    setSubmitting(true);
    try {
      await api.post('/transactions', {
        items: cart,
        paymentMethod,
        creditCustomerId: selectedCustomer?.id ?? undefined,
        channel: 'app',
      });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      clearCart();
      closeCheckout();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not submit order.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleAddToCart = (product: Product) => {
    addToCart({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: 1,
      subtotal: Number(product.price),
    });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.grey} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={colors.grey}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard product={item} onPress={handleAddToCart} />
        )}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {search ? 'No products found' : 'Start by adding products in Inventory'}
            </Text>
          </View>
        }
      />

      {cart.length > 0 && (
        <View style={styles.cartBar}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartCount}>{cartItemCount} items</Text>
            <Text style={styles.cartTotal}>₱{cartTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={openCheckout}>
            <Text style={styles.checkoutText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.pale} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Checkout Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={checkoutVisible}
        animationType="slide"
        transparent
        onRequestClose={closeCheckout}
      >
        <Pressable style={styles.backdrop} onPress={closeCheckout} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Checkout</Text>
              <TouchableOpacity onPress={closeCheckout}>
                <Ionicons name="close" size={24} color={colors.grey} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Cart items */}
              {cart.map((item) => (
                <View key={`${item.productId}-${item.productName}`} style={styles.cartLine}>
                  <Text style={styles.cartLineName} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={styles.cartLineQty}>×{item.quantity}</Text>
                  <Text style={styles.cartLineSubtotal}>₱{Number(item.subtotal).toFixed(2)}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>₱{cartTotal.toFixed(2)}</Text>
              </View>

              <View style={styles.divider} />

              {/* Payment method */}
              <Text style={styles.sectionLabel}>Payment Method</Text>
              <View style={styles.paymentGrid}>
                {PAYMENT_METHODS.map(({ key, label, icon }) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.paymentBtn, paymentMethod === key && styles.paymentBtnActive]}
                    onPress={() => {
                      setPaymentMethod(key);
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                    }}
                  >
                    <Ionicons
                      name={icon as any}
                      size={22}
                      color={paymentMethod === key ? colors.green : colors.grey}
                    />
                    <Text style={[styles.paymentBtnText, paymentMethod === key && styles.paymentBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Credit customer picker */}
              {paymentMethod === 'credit' && (
                <>
                  <Text style={styles.sectionLabel}>Customer</Text>
                  <TextInput
                    style={styles.input}
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    placeholder="Search customer..."
                    placeholderTextColor={colors.grey}
                    autoCapitalize="words"
                  />
                  {filteredCustomers.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.customerRow,
                        selectedCustomer?.id === c.id && styles.customerRowActive,
                      ]}
                      onPress={() => setSelectedCustomer(c)}
                    >
                      <Text style={styles.customerName}>{c.name}</Text>
                      {c.balance > 0 && (
                        <Text style={styles.customerBalance}>owes ₱{c.balance.toFixed(2)}</Text>
                      )}
                      {selectedCustomer?.id === c.id && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                      )}
                    </TouchableOpacity>
                  ))}
                  {filteredCustomers.length === 0 && customerSearch.length > 0 && (
                    <Text style={styles.noCustomers}>No customers found</Text>
                  )}
                </>
              )}

              {/* Confirm */}
              <TouchableOpacity
                style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.dark} size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Order · ₱{cartTotal.toFixed(2)}</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: spacing.xl }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  center: {
    flex: 1,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.pale,
    fontSize: 16,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  emptyText: {
    color: colors.grey,
    fontSize: 16,
    textAlign: 'center',
  },
  cartBar: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.green,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cartInfo: {
    flex: 1,
  },
  cartCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  cartTotal: {
    color: colors.pale,
    fontSize: 20,
    fontWeight: 'bold',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
  },
  checkoutText: {
    color: colors.pale,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: spacing.xs,
  },
  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.pale,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cartLineName: {
    flex: 1,
    color: colors.pale,
    fontSize: 15,
  },
  cartLineQty: {
    color: colors.grey,
    fontSize: 14,
    marginHorizontal: spacing.sm,
    minWidth: 28,
    textAlign: 'right',
  },
  cartLineSubtotal: {
    color: colors.pale,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 72,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  totalLabel: {
    color: colors.grey,
    fontSize: 16,
    fontWeight: '600',
  },
  totalAmount: {
    color: colors.pale,
    fontSize: 22,
    fontWeight: 'bold',
  },
  sectionLabel: {
    color: colors.grey,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paymentGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paymentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 4,
  },
  paymentBtnActive: {
    borderColor: colors.green,
  },
  paymentBtnText: {
    color: colors.grey,
    fontSize: 12,
    fontWeight: '600',
  },
  paymentBtnTextActive: {
    color: colors.green,
  },
  input: {
    backgroundColor: colors.dark,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.pale,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.dark,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  customerRowActive: {
    borderColor: colors.green,
  },
  customerName: {
    flex: 1,
    color: colors.pale,
    fontSize: 15,
  },
  customerBalance: {
    color: colors.grey,
    fontSize: 13,
    marginRight: spacing.sm,
  },
  noCustomers: {
    color: colors.grey,
    textAlign: 'center',
    paddingVertical: spacing.md,
    fontSize: 14,
  },
  confirmBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: colors.dark,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
