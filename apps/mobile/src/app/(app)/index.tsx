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
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../constants/theme';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { ProductCard } from '../../components/ProductCard';
import type { Product } from '@litro/types';

export default function POSScreen() {
  const [search, setSearch] = useState('');
  const { cart, addToCart, clearCart } = useAppStore();

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const cartTotal = cart.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

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
          <TouchableOpacity 
            style={styles.checkoutButton}
            onPress={() => {/* TODO: Implement checkout modal/screen */}}
          >
            <Text style={styles.checkoutText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.pale} />
          </TouchableOpacity>
        </View>
      )}
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
    paddingBottom: 100, // Space for cart bar
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
});
