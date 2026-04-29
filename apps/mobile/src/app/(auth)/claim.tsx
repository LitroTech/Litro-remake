import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../../constants/theme';
import { useAppStore } from '../../lib/store';
import { api, setAuthToken } from '../../lib/api';

export default function ClaimScreen() {
  const [storeName, setStoreName] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [mode, setMode] = useState<'create' | 'claim'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const setSession = useAppStore((state) => state.setSession);

  const handleSubmit = async () => {
    if (mode === 'create' && !storeName) {
      setError('Please enter a store name');
      return;
    }
    if (mode === 'claim' && !recoveryCode) {
      setError('Please enter your recovery code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        const response = await api.post<{ token: string; session: any; recoveryCode: string }>(
          '/store/create',
          { name: storeName }
        );
        // In a real app, we would show the recovery code here and make them save it
        setAuthToken(response.token);
        setSession(response.session);
        router.replace('/(app)');
      } else {
        const response = await api.post<{ token: string; session: any }>(
          '/store/claim',
          { recoveryCode }
        );
        setAuthToken(response.token);
        setSession(response.session);
        router.replace('/(app)');
      }
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, mode === 'create' && styles.activeTab]}
            onPress={() => setMode('create')}
          >
            <Text style={[styles.tabText, mode === 'create' && styles.activeTabText]}>Create New</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'claim' && styles.activeTab]}
            onPress={() => setMode('claim')}
          >
            <Text style={[styles.tabText, mode === 'claim' && styles.activeTabText]}>Claim Existing</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{mode === 'create' ? 'Start your Litro Store' : 'Recover Store'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'create' 
              ? 'Everything starts with a name. No emails, no passwords.' 
              : 'Enter your 12-character recovery code to regain access.'}
          </Text>

          {mode === 'create' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Store Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Aling Nena's Sari-sari"
                placeholderTextColor={colors.grey}
                value={storeName}
                onChangeText={setStoreName}
              />
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Recovery Code</Text>
              <TextInput
                style={styles.input}
                placeholder="XXXX-XXXX-XXXX"
                placeholderTextColor={colors.grey}
                value={recoveryCode}
                onChangeText={setRecoveryCode}
                autoCapitalize="characters"
              />
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.pale} />
            ) : (
              <Text style={styles.buttonText}>{mode === 'create' ? 'Initialize Store' : 'Claim Ownership'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Litro uses device-based authentication. Your store is linked to this phone. Keep your recovery code safe!
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  backButton: {
    marginBottom: spacing.xl,
  },
  backButtonText: {
    color: colors.grey,
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.ink,
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: colors.dark,
  },
  tabText: {
    color: colors.grey,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.green,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.pale,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.pale,
    opacity: 0.7,
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.pale,
    fontSize: 14,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.grey,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.pale,
    fontSize: 16,
  },
  errorText: {
    color: colors.red,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.green,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: {
    color: colors.pale,
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    marginTop: spacing.xxl,
    padding: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  infoText: {
    color: colors.grey,
    fontSize: 13,
    lineHeight: 18,
  },
});
