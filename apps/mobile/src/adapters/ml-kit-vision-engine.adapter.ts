import type { DecodedScanResult, VisionEngineAdapter } from "@indinv/core-domain";

/**
 * Implementación del puerto VisionEngineAdapter usando Google ML Kit
 * (barcode scanning) en el smartphone (ADR-001 §2). El caso de uso de
 * dominio nunca importa este archivo directamente ni conoce ML Kit.
 *
 * TODO: reemplazar el cuerpo por la llamada real a
 * `@react-native-ml-kit/barcode-scanning` una vez agregada la dependencia
 * nativa al proyecto Expo (requiere EAS / dev client, no funciona en Expo Go).
 */
export class MlKitVisionEngineAdapter implements VisionEngineAdapter {
  async decode(_imageBuffer: Uint8Array): Promise<DecodedScanResult[]> {
    throw new Error("MlKitVisionEngineAdapter.decode: not yet wired to native ML Kit module");
  }
}
