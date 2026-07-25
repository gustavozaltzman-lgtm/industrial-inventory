import * as Battery from "expo-battery";
import * as SecureStore from "expo-secure-store";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { Camera } from "expo-camera";
import type {
  BatteryStatus,
  DeviceAdapter,
  NetworkKind,
  NetworkStatus,
} from "./DeviceAdapter.js";

const DEVICE_ID_KEY = "indinv.device.id";

function toNetworkKind(type: NetInfoState["type"]): NetworkKind {
  switch (type) {
    case "wifi":
      return "wifi";
    case "cellular":
      return "cellular";
    case "ethernet":
      return "ethernet";
    case "vpn":
      return "vpn";
    case "none":
      return "none";
    default:
      return "unknown";
  }
}

function toNetworkStatus(state: NetInfoState): NetworkStatus {
  return {
    isConnected: state.isConnected ?? false,
    // NetInfo devuelve null mientras aún no lo determinó: lo tratamos como
    // "no alcanzable" para no disparar sync a ciegas desde una red de planta
    // que asocia pero no rutea.
    isInternetReachable: state.isInternetReachable ?? false,
    kind: toNetworkKind(state.type),
  };
}

export class ExpoDeviceAdapter implements DeviceAdapter {
  private flashOn = false;

  async getDeviceId(): Promise<string> {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const generated = globalThis.crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
    return generated;
  }

  async getBatteryStatus(): Promise<BatteryStatus> {
    const [level, state] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
    ]);
    return {
      level,
      isCharging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    };
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    return toNetworkStatus(await NetInfo.fetch());
  }

  onNetworkChange(listener: (status: NetworkStatus) => void): () => void {
    return NetInfo.addEventListener((state) => listener(toNetworkStatus(state)));
  }

  async hasCameraPermission(): Promise<boolean> {
    const { granted } = await Camera.getCameraPermissionsAsync();
    return granted;
  }

  async requestCameraPermission(): Promise<boolean> {
    const { granted } = await Camera.requestCameraPermissionsAsync();
    return granted;
  }

  async toggleFlash(on: boolean): Promise<void> {
    this.flashOn = on;
  }

  isFlashOn(): boolean {
    return this.flashOn;
  }
}
