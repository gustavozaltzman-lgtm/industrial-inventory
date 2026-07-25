/**
 * Feedback operativo al operario. En planta el usuario suele tener guantes,
 * protección auditiva parcial y no mira la pantalla entre escaneo y escaneo:
 * la confirmación tiene que ser háptica y sonora, no solo visual.
 */
export interface FeedbackAdapter {
  success(): Promise<void>;
  warning(): Promise<void>;
  error(): Promise<void>;
}
