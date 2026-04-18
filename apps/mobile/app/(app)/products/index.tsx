import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '../../../src/components/ui/Screen'
import { StockBadge } from '../../../src/components/ui/StockBadge'
import { api } from '../../../src/lib/api'
import { useLanguage } from '../../../src/lib/store'
import { colors } from '../../../src/constants/theme'
import type { Product } from '@litro/types'

export default function ProductsScreen() {
  const language = useLanguage()
  const tl = language === 'tl'
  const [search, setSearch] = useState('')

  const { data: products = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  })

  const filtered = search.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : products

  const renderItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/(app)/products/edit', params: { id: item.id } })}
    >
      <View style={styles.cardTop}>
        <StockBadge level={item.stockColor} size="sm" />
        <Text style={styles.price}>₱{item.price.toFixed(2)}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      {item.stockMode === 'numerical' && (
        <Text style={styles.qty}>
          {item.quantity} {tl ? 'natitira' : 'left'}
        </Text>
      )}
    </TouchableOpacity>
  )

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.pale} />
        </TouchableOpacity>
        <Text style={styles.title}>{tl ? 'Mga Produkto' : 'Products'}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(app)/products/add')}
          hitSlop={12}
        >
          <Ionicons name="add" size={24} color={colors.dark} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.grey} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={tl ? 'Hanapin...' : 'Search...'}
          placeholderTextColor={colors.grey}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          {search ? (
            <Text style={styles.empty}>
              {tl ? 'Walang nahanap.' : 'No results.'}
            </Text>
          ) : (
            <>
              <Text style={styles.empty}>
                {tl ? 'Wala pang produkto.' : 'No products yet.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/(app)/products/add')}
              >
                <Text style={styles.emptyBtnLabel}>
                  {tl ? '+ Magdagdag ng produkto' : '+ Add a product'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1F1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A3530',
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: colors.pale,
    height: 44,
  },
  list: { paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: '#0D1F1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A3530',
    padding: 14,
    gap: 6,
    minHeight: 110,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: colors.pale,
    lineHeight: 20,
  },
  price: {
    fontFamily: 'BricolageGrotesque-Bold',
    fontSize: 14,
    color: colors.green,
  },
  qty: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: colors.grey,
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
})
