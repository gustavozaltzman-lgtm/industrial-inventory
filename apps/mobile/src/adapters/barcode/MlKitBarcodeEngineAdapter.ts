import type { DecodedScanResult, VisionEngineAdapter } from "@indinv/core-domain";
import type { BarcodeEngineAdapter, CameraFrame } from "./BarcodeEngineAdapter.js";

/**
 * Motor de lectura sobre Google ML Kit (cámara del smartphone).
 *
 * Implementa también `VisionEngineAdapter` del dominio: `scanFromBuffer` y
 * `decode` son la misma operación, así que un único adaptador satisface tanto
 * el puerto de hardware como el de dominio sin duplicar lógica.
 *
 * TODO: cablear `@react-native-ml-kit/barcode-scanning`. Requiere módulo
 * nativo, o sea EAS dev client — no funciona en Expo Go.
 */
export class MlKitBarcodeEngineAdapter implements BarcodeEngineAdapter, VisionEngineAdapter {
  readonly engineName = "GOOGLE_ML_KIT";

  async processFrame(_frame: CameraFrame): Promise<DecodedScanResult[]> {
    throw new Error("MlKitBarcodeEngineAdapter.processFrame: falta cablear el módulo nativo");
  }

  async scanFromBuffer(_buffer: Uint8Array): Promise<DecodedScanResult[]> {
    throw new Error("MlKitBarcodeEngineAdapter.scanFromBuffer: falta cablear el módulo nativo");
  }

  /** Alias del puerto de dominio VisionEngineAdapter. */
  decode(imageBuffer: Uint8Array): Promise<DecodedScanResult[]> {
    return this.scanFromBuffer(imageBuffer);
  }
}
