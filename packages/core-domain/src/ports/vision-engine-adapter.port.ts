export interface DecodedScanResult {
  value: string;
  symbology: "EAN13" | "CODE128" | "QR_CODE" | "DATA_MATRIX" | "UNKNOWN";
  confidence: number;
}

/**
 * Puerto para motores de visión/decodificación. Hoy: Google ML Kit en un
 * smartphone Android. Mañana: un lector industrial Cognex vía TCP Socket.
 * El caso de uso de dominio depende únicamente de esta interfaz (ADR-001 §2).
 */
export interface VisionEngineAdapter {
  decode(imageBuffer: Uint8Array): Promise<DecodedScanResult[]>;
}
