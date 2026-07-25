import "../src/polyfills.js";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "IndInv — Toma de Inventario" }} />
    </Stack>
  );
}
