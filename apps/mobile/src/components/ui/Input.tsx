import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  type TextInputProps,
} from 'react-native'
import { colors } from '../../constants/theme'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNTextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.grey}
        selectionColor={colors.green}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: colors.grey,
  },
  input: {
    backgroundColor: '#0D1F1A',
    borderWidth: 1.5,
    borderColor: '#1A3530',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'DMSans-Regular',
    color: colors.pale,
  },
  inputError: {
    borderColor: '#D94F4F',
  },
  error: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#D94F4F',
  },
})
