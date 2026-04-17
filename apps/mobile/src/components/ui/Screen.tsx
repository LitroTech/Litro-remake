import { SafeAreaView, ScrollView, View, StyleSheet, type ViewStyle } from 'react-native'
import { colors } from '../../constants/theme'

interface ScreenProps {
  children: React.ReactNode
  scroll?: boolean
  style?: ViewStyle
  /** Remove horizontal padding — useful for full-bleed grids */
  noPadding?: boolean
}

export function Screen({ children, scroll = false, style, noPadding }: ScreenProps) {
  const inner = (
    <View style={[styles.inner, noPadding && styles.noPadding, style]}>
      {children}
    </View>
  )

  return (
    <SafeAreaView style={styles.root}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.inner, noPadding && styles.noPadding, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : inner}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scroll: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noPadding: {
    paddingHorizontal: 0,
  },
})
