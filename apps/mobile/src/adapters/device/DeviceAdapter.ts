export type NetworkKind = "wifi" | "cellular" | "ethernet" | "vpn" | "none" | "unknown";

export interface NetworkStatus {
  isConnected: boolean;
  /** Conectividad real a internet, no solo asociación al AP (crítico en planta). */
  isInternetReachable: boolean;
  kind: NetworkKind;
}

export interface BatteryStatus {
  /** 0..1 */
  level: number;
  isCharging: boolean;
}

/**
 * Abstracción de las capacidades del equipo. Existe para que la UI y el
 * CaptureEngine nunca importen expo-camera, expo-battery ni NetInfo: el mismo
 * código corre en un smartphone, en una Zebra rugged o en un mock de test.
 */
export interface DeviceAdapter {
  /** Identificador estable del equipo; viaja en cada evento como `deviceId`. */
  getDeviceId(): Promise<string>;
  getBatteryStatus(): Promise<BatteryStatus>;
  getNetworkStatus(): Promise<NetworkStatus>;
  /** Devuelve una función de baja para el listener. */
  onNetworkChange(listener: (status: NetworkStatus) => void): () => void;
  hasCameraPermission(): Promise<boolean>;
  requestCameraPermission(): Promise<boolean>;
  toggleFlash(on: boolean): Promise<void>;
  isFlashOn(): boolean;
}
