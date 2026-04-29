import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, stockColors } from '../../constants/theme';
import { api } from '../../lib/api';
import type { Product } from '@litro/types';

export default function ProductsScreen() {
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const renderItem = ({ item }: { item: Product }) => {
    const getStockColor = () => {
      if (item.stockMode === 'descriptive') {
        switch (item.stockLevel) {
          case 'high': return stockColors.green;
          case 'medium': return stockColors.yellow;
          case 'low': return stockColors.red;
          case 'none': return stockColors.grey;
          default: return stockColors.grey;
        }
      } else if (item.quantity !== null && item.initialQuantity !== null) {
        const percentage = (item.quantity / item.initialQuantity) * 100;
        if (percentage > 50) return stockColors.green;
        if (percentage >= 20) return stockColors.yellow;
        if (percentage > 0) return stockColors.red;
        return stockColors.grey;
      }
      return stockColors.grey;
    };

    const stockColor = getStockColor();

    return (
      <TouchableOpacity style={styles.productRow}>
        <View style={[styles.stockBadge, { backgroundColor: stockColor }]} />
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productPrice}>₱{Number(item.price).toFixed(2)}</Text>
        </View>
        <View style={styles.stockInfo}>
          <Text style={[styles.stockValue, { color: stockColor }]}>
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
        <TouchableOpacity style={styles.addButton}>
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
            <TouchableOpacity style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>Add your first product</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
});
