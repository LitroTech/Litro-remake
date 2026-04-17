import { View, StyleSheet } from 'react-native'
import { colors } from '../../constants/theme'

type StockColor = 'green' | 'yellow' | 'red' | 'grey'

interface StockBadgeProps {
  color: StockColor | null
  size?: number
}

const COLOR_MAP: Record<StockColor, string> = {
  green: colors.green,
  yellow: '#E8A838',
  red: '#D94F4F',
  grey: colors.grey,
}

export function StockBadge({ color, size = 8 }: StockBadgeProps) {
  if (!color) return null
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: COLOR_MAP[color] },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  dot: {
    flexShrink: 0,
  },
})
