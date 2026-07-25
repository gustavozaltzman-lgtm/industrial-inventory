import type { DecodedScanResult } from "@indinv/core-domain";

/**
 * Frame crudo entregado por la cámara. Se mantiene opaco a propósito: cada
 * motor (ML Kit, VisionCamera, SDK de Cognex) lo interpreta a su manera y ni
 * la UI ni el CaptureEngine necesitan conocer su forma interna.
 */
export interface CameraFrame {
  readonly width: number;
  readonly height: number;
  readonly nativeRef: unknown;
}

/**
 * Puerto de hardware para motores de lectura de códigos. Es el nivel "frame",
 * un concepto del dispositivo — por eso vive en la app y no en el dominio.
 * Reutiliza `DecodedScanResult` de @indinv/core-domain: no redefine DTOs.
 *
 * Implementaciones previstas: ML Kit (cámara del smartphone), DataWedge
 * (Zebra), SDK Cognex vía socket, cámara IP fija.
 */
export interface BarcodeEngineAdapter {
  readonly engineName: string;
  /** Procesa un frame en vivo del stream de cámara. */
  processFrame(frame: CameraFrame): Promise<DecodedScanResult[]>;
  /** Decodifica una imagen ya capturada (foto, archivo, buffer de red). */
  scanFromBuffer(buffer: Uint8Array): Promise<DecodedScanResult[]>;
}
