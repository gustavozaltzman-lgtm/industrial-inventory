import * as ExpoCrypto from "expo-crypto";

/**
 * @indinv/core-domain usa globalThis.crypto.randomUUID() para mantenerse
 * runtime-agnostic (Node en backend, RN en mobile). Hermes no siempre trae
 * Web Crypto completo, así que rellenamos randomUUID con expo-crypto.
 * Debe importarse antes que cualquier otro módulo (ver index.ts).
 */
if (typeof globalThis.crypto === "undefined") {
  // @ts-expect-error -- polyfill mínimo, solo se usa randomUUID
  globalThis.crypto = {};
}

if (typeof globalThis.crypto.randomUUID !== "function") {
  globalThis.crypto.randomUUID = ExpoCrypto.randomUUID as unknown as Crypto["randomUUID"];
}
