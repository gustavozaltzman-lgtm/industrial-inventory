import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      <Tabs.Screen name="scan" options={{ title: "Escaneo" }} />
    </Tabs>
  );
}
