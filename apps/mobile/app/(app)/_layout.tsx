import { Stack } from 'expo-router'
import { colors } from '../../src/constants/theme'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dark } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="checkout/index" options={{ animation: 'none' }} />
      <Stack.Screen name="products/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="products/add" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      <Stack.Screen name="products/edit" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      <Stack.Screen name="chat/index" options={{ animation: 'none' }} />
      <Stack.Screen name="history/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="expenses/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="staff/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="credits/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/index" options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}
