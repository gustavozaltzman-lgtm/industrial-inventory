import * as Haptics from "expo-haptics";
import type { FeedbackAdapter } from "./FeedbackAdapter";

/**
 * Implementación háptica. El beeper industrial (audio) se suma acá cuando se
 * defina el perfil sonoro; la UI no cambia porque depende de la interfaz.
 */
export class HapticFeedbackAdapter implements FeedbackAdapter {
  async success(): Promise<void> {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async warning(): Promise<void> {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  async error(): Promise<void> {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}
