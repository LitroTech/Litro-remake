import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing } from '../../constants/theme';
import { api } from '../../lib/api';
import type { Transaction } from '@litro/types';

export default function TransactionsScreen() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get<Transaction[]>('/transactions'),
  });

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionRow}>
      <View style={styles.left}>
        <Text style={styles.date}>
          {new Date(item.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.method}>{item.paymentMethod.toUpperCase()}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>₱{Number(item.totalAmount).toFixed(2)}</Text>
        <Text style={styles.channel}>{item.channel === 'messenger' ? 'Messenger' : 'App'}</Text>
      </View>
    </View>
  );

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
        <Text style={styles.title}>History</Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions yet.</Text>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.pale,
  },
  listContent: {
    padding: spacing.md,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ink,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  left: {
    flex: 1,
  },
  date: {
    color: colors.pale,
    fontSize: 16,
    fontWeight: '600',
  },
  method: {
    color: colors.grey,
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    color: colors.green,
    fontSize: 18,
    fontWeight: 'bold',
  },
  channel: {
    color: colors.grey,
    fontSize: 10,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: colors.grey,
    fontSize: 16,
  },
});
