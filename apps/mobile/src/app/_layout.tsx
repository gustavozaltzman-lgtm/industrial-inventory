import "../polyfills.js";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { getContainer } from "../composition/container";

export default function RootLayout() {
  useEffect(() => {
    const { sync } = getContainer();
    void sync.start();
    return () => sync.stop();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
