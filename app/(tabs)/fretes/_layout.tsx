// app/(tabs)/fretes/_layout.tsx
import { Stack } from "expo-router";
export default function FretesStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Fretes" }} />
      <Stack.Screen name="[id]" options={{ title: "Detalhe do frete" }} />
    </Stack>
  );
}
