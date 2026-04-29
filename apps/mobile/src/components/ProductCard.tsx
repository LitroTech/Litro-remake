import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, stockColors } from '../constants/theme';
import type { Product } from '@litro/types';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  const getStockColor = () => {
    if (product.stockMode === 'descriptive') {
      switch (product.stockLevel) {
        case 'high': return stockColors.green;
        case 'medium': return stockColors.yellow;
        case 'low': return stockColors.red;
        case 'none': return stockColors.grey;
        default: return stockColors.grey;
      }
    } else if (product.quantity !== null && product.initialQuantity !== null) {
      const percentage = (product.quantity / product.initialQuantity) * 100;
      if (percentage > 50) return stockColors.green;
      if (percentage >= 20) return stockColors.yellow;
      if (percentage > 0) return stockColors.red;
      return stockColors.grey;
    }
    return stockColors.grey;
  };

  const stockColor = getStockColor();

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => onPress(product)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {product.photoUrl ? (
          <Image source={{ uri: product.photoUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>{product.name[0]}</Text>
          </View>
        )}
        <View style={[styles.stockIndicator, { backgroundColor: stockColor }]} />
      </View>
      
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.price}>₱{Number(product.price).toFixed(2)}</Text>
        
        <Text style={[styles.stockText, { color: stockColor }]}>
          {product.stockMode === 'numerical' 
            ? `${product.quantity} in stock` 
            : `${product.stockLevel?.toUpperCase()} stock`}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    padding: spacing.sm,
    width: '48%',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  imageContainer: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.dark,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.grey,
    fontSize: 32,
    fontWeight: 'bold',
  },
  stockIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  info: {
    marginTop: spacing.sm,
  },
  name: {
    color: colors.pale,
    fontSize: 14,
    fontWeight: '600',
  },
  price: {
    color: colors.green,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  stockText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
});
