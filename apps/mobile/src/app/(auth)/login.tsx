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
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../../constants/theme';
import { useAppStore } from '../../lib/store';
import { api, setAuthToken } from '../../lib/api';

export default function LoginScreen() {
  const [accessCode, setAccessCode] = useState('');
  const [staffName, setStaffName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const setSession = useAppStore((state) => state.setSession);

  const handleJoin = async () => {
    if (!accessCode || !staffName) {
      setError('Please fill in both fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ token: string; session: any }>(
        '/store/join',
        { accessCode, name: staffName }
      );
      
      setAuthToken(response.token);
      setSession(response.session);
      router.replace('/(app)');
    } catch (err: any) {
      setError(err.message || 'Failed to join store');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Litro</Text>
        <Text style={styles.subtitle}>Sari-sari store management, simplified.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Access Code</Text>
          <TextInput
            style={styles.input}
            placeholder="8-character code"
            placeholderTextColor={colors.grey}
            value={accessCode}
            onChangeText={setAccessCode}
            autoCapitalize="characters"
            maxLength={8}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Maria"
            placeholderTextColor={colors.grey}
            value={staffName}
            onChangeText={setStaffName}
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={styles.button}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.pale} />
          ) : (
            <Text style={styles.buttonText}>Join Store</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/claim')}
        >
          <Text style={styles.secondaryButtonText}>I'm the Owner / Create Store</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.green,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 18,
    color: colors.pale,
    opacity: 0.8,
    marginBottom: spacing.xxl,
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
  secondaryButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.grey,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
