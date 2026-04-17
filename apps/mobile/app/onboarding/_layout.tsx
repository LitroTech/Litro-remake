import { Stack } from 'expo-router'
import { colors } from '../../src/constants/theme'

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.dark } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="join" options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}
