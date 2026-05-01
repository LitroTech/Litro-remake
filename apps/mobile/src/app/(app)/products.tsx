import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, stockColors } from '../../constants/theme';
import { api } from '../../lib/api';
import type { Product, StockMode, StockLevel } from '@litro/types';

interface ProductForm {
  name: string;
  price: string;
  stockMode: StockMode;
  quantity: string;
  stockLevel: StockLevel;
}

const BLANK_FORM: ProductForm = {
  name: '',
  price: '',
  stockMode: 'numerical',
  quantity: '',
  stockLevel: 'high',
};

function formFromProduct(p: Product): ProductForm {
  return {
    name: p.name,
    price: String(p.price),
    stockMode: p.stockMode,
    quantity: p.quantity !== null ? String(p.quantity) : '',
    stockLevel: p.stockLevel ?? 'high',
  };
}

function levelColor(level: StockLevel): string {
  switch (level) {
    case 'high': return stockColors.green;
    case 'medium': return stockColors.yellow;
    case 'low': return stockColors.red;
    case 'none': return stockColors.grey;
  }
}

function colorFromProduct(item: Product): string {
  if (item.stockColor) return stockColors[item.stockColor];
  if (item.stockMode === 'descriptive' && item.stockLevel) return levelColor(item.stockLevel);
  return stockColors.grey;
}

export default function ProductsScreen() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  function openCreate() {
    setEditingProduct(null);
    setForm(BLANK_FORM);
    setModalVisible(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setForm(formFromProduct(product));
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
  }

  async function handleSave() {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name || isNaN(price) || price < 0) return;

    const body: Record<string, unknown> = { name, price, stockMode: form.stockMode };
    if (form.stockMode === 'numerical') {
      const qty = parseInt(form.quantity, 10);
      body.quantity = isNaN(qty) ? 0 : qty;
    } else {
      body.stockLevel = form.stockLevel;
    }

    setSaving(true);
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, body);
      } else {
        await api.post('/products', body);
      }
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save product.');
    } finally {
      setSaving(false);
    }
  }

  function handleDeletePress() {
    if (!editingProduct) return;
    Alert.alert(
      'Delete Product',
      `Delete "${editingProduct.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]
    );
  }

  async function confirmDelete() {
    if (!editingProduct) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${editingProduct.id}`);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not delete product.');
    } finally {
      setDeleting(false);
    }
  }

  const canSave =
    form.name.trim().length > 0 &&
    !isNaN(parseFloat(form.price)) &&
    parseFloat(form.price) >= 0 &&
    (form.stockMode === 'descriptive' || form.quantity.trim().length > 0);

  const renderItem = ({ item }: { item: Product }) => {
    const color = colorFromProduct(item);
    return (
      <TouchableOpacity style={styles.productRow} onPress={() => openEdit(item)}>
        <View style={[styles.stockBadge, { backgroundColor: color }]} />
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productPrice}>₱{Number(item.price).toFixed(2)}</Text>
        </View>
        <View style={styles.stockInfo}>
          <Text style={[styles.stockValue, { color }]}>
            {item.stockMode === 'numerical' ? item.quantity : item.stockLevel}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.grey} />
        </View>
      </TouchableOpacity>
    );
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
        <Text style={styles.title}>Inventory</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Ionicons name="add" size={24} color={colors.pale} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isLoading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color={colors.grey} />
            <Text style={styles.emptyText}>No products yet.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openCreate}>
              <Text style={styles.emptyButtonText}>Add your first product</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <Pressable style={styles.backdrop} onPress={closeModal} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingProduct ? 'Edit Product' : 'New Product'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={colors.grey} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Coca-Cola 1.5L"
                placeholderTextColor={colors.grey}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Price (₱)</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                placeholder="0.00"
                placeholderTextColor={colors.grey}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Stock Tracking</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, form.stockMode === 'numerical' && styles.toggleActive]}
                  onPress={() => setForm((f) => ({ ...f, stockMode: 'numerical' }))}
                >
                  <Text style={[styles.toggleText, form.stockMode === 'numerical' && styles.toggleActiveText]}>
                    Numerical
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, form.stockMode === 'descriptive' && styles.toggleActive]}
                  onPress={() => setForm((f) => ({ ...f, stockMode: 'descriptive' }))}
                >
                  <Text style={[styles.toggleText, form.stockMode === 'descriptive' && styles.toggleActiveText]}>
                    Descriptive
                  </Text>
                </TouchableOpacity>
              </View>

              {form.stockMode === 'numerical' && (
                <>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={form.quantity}
                    onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
                    placeholder="0"
                    placeholderTextColor={colors.grey}
                    keyboardType="number-pad"
                  />
                </>
              )}

              {form.stockMode === 'descriptive' && (
                <>
                  <Text style={styles.label}>Stock Level</Text>
                  <View style={styles.levelRow}>
                    {(['high', 'medium', 'low', 'none'] as StockLevel[]).map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.levelBtn,
                          form.stockLevel === level && styles.levelBtnActive,
                          form.stockLevel === level && { borderColor: levelColor(level) },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, stockLevel: level }))}
                      >
                        <Text
                          style={[
                            styles.levelBtnText,
                            form.stockLevel === level && { color: levelColor(level) },
                          ]}
                        >
                          {level}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!canSave || saving || deleting}
              >
                {saving ? (
                  <ActivityIndicator color={colors.dark} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingProduct ? 'Save Changes' : 'Add Product'}
                  </Text>
                )}
              </TouchableOpacity>

              {editingProduct && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={handleDeletePress}
                  disabled={saving || deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color={colors.red} size="small" />
                  ) : (
                    <Text style={styles.deleteBtnText}>Delete Product</Text>
                  )}
                </TouchableOpacity>
              )}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.pale,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.green,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
  },
  addButtonText: {
    color: colors.pale,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  listContent: {
    padding: spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  stockBadge: {
    width: 4,
    height: 30,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: colors.pale,
    fontSize: 16,
    fontWeight: '600',
  },
  productPrice: {
    color: colors.grey,
    fontSize: 14,
    marginTop: 2,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: colors.grey,
    fontSize: 18,
    marginTop: spacing.md,
  },
  emptyButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.ink,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grey,
  },
  emptyButtonText: {
    color: colors.green,
    fontWeight: 'bold',
  },
  // Modal / bottom sheet
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
  label: {
    color: colors.grey,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.dark,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.pale,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleActive: {
    borderColor: colors.green,
  },
  toggleText: {
    color: colors.grey,
    fontWeight: '600',
  },
  toggleActiveText: {
    color: colors.green,
  },
  levelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  levelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  levelBtnActive: {
    borderWidth: 1,
  },
  levelBtnText: {
    color: colors.grey,
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  saveBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: colors.dark,
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteBtn: {
    marginTop: spacing.sm,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.red,
  },
  deleteBtnText: {
    color: colors.red,
    fontWeight: '600',
    fontSize: 16,
  },
});
