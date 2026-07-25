import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Solo lógica pura (engine, colas, máquina de estados). Los archivos de
    // UI y los adaptadores nativos quedan fuera a propósito: requieren
    // runtime de React Native, no de Node.
    include: ["src/tests/**/*.test.ts"],
  },
});
