import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../constants/theme';
import { useAppStore } from '../../lib/store';

export default function SettingsScreen() {
  const { session, logout } = useAppStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Information</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Store Name</Text>
              <Text style={styles.value}>{session?.storeName || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tier</Text>
              <Text style={styles.value}>{session?.subscriptionTier?.toUpperCase() || 'BASIC'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.red} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.version}>Litro v0.1.0</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.pale,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.grey,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.pale,
    fontSize: 16,
  },
  value: {
    color: colors.grey,
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    padding: spacing.md,
    borderRadius: 12,
  },
  logoutText: {
    color: colors.red,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  version: {
    color: colors.grey,
    fontSize: 12,
  },
});
