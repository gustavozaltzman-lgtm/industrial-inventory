export type ScanStateName =
  | "Idle"
  | "OpeningCamera"
  | "Scanning"
  | "LocationDetected"
  | "ProductDetected"
  | "Validating"
  | "SavingLocal"
  | "PendingSync"
  | "Syncing"
  | "Completed"
  | "Error";

export type ScanEvent =
  | { type: "OPEN_CAMERA" }
  | { type: "CAMERA_READY" }
  | { type: "LOCATION_SCANNED"; code: string }
  | { type: "PRODUCT_SCANNED"; code: string }
  | { type: "VALIDATE" }
  | { type: "VALIDATION_OK" }
  | { type: "VALIDATION_FAILED"; reason: string }
  | { type: "SAVED_LOCAL" }
  | { type: "SYNC_STARTED" }
  | { type: "SYNC_OK" }
  | { type: "SYNC_FAILED"; reason: string }
  | { type: "SCAN_AGAIN" }
  | { type: "RESET" }
  | { type: "FAIL"; reason: string };

export interface ScanContext {
  locationCode?: string;
  productCode?: string;
  errorReason?: string;
}

export interface ScanState {
  name: ScanStateName;
  context: ScanContext;
}

export const initialScanState: ScanState = { name: "Idle", context: {} };

/**
 * Transiciones válidas del ciclo de vida de un escaneo. Se declara como tabla
 * para que los estados alcanzables sean auditables de un vistazo y para que
 * un evento fuera de orden (típico con lectores que disparan repetido) sea
 * ignorado en vez de dejar la pantalla en un estado incoherente.
 */
const TRANSITIONS: Record<ScanStateName, ReadonlyArray<ScanEvent["type"]>> = {
  Idle: ["OPEN_CAMERA", "RESET", "FAIL"],
  OpeningCamera: ["CAMERA_READY", "FAIL", "RESET"],
  Scanning: ["LOCATION_SCANNED", "PRODUCT_SCANNED", "FAIL", "RESET"],
  LocationDetected: ["PRODUCT_SCANNED", "FAIL", "RESET"],
  ProductDetected: ["VALIDATE", "FAIL", "RESET"],
  Validating: ["VALIDATION_OK", "VALIDATION_FAILED", "FAIL", "RESET"],
  SavingLocal: ["SAVED_LOCAL", "FAIL", "RESET"],
  PendingSync: ["SYNC_STARTED", "SCAN_AGAIN", "RESET", "FAIL"],
  Syncing: ["SYNC_OK", "SYNC_FAILED", "RESET"],
  Completed: ["SCAN_AGAIN", "RESET"],
  Error: ["RESET", "SCAN_AGAIN"],
};

function nextName(current: ScanStateName, event: ScanEvent): ScanStateName {
  switch (event.type) {
    case "OPEN_CAMERA":
      return "OpeningCamera";
    case "CAMERA_READY":
      return "Scanning";
    case "LOCATION_SCANNED":
      return "LocationDetected";
    case "PRODUCT_SCANNED":
      return "ProductDetected";
    case "VALIDATE":
      return "Validating";
    case "VALIDATION_OK":
      return "SavingLocal";
    case "VALIDATION_FAILED":
      return "Error";
    case "SAVED_LOCAL":
      return "PendingSync";
    case "SYNC_STARTED":
      return "Syncing";
    case "SYNC_OK":
      return "Completed";
    case "SYNC_FAILED":
      // Queda pendiente, no se pierde: el QueueManager reintenta con backoff.
      return "PendingSync";
    case "SCAN_AGAIN":
      return "Scanning";
    case "RESET":
      return "Idle";
    case "FAIL":
      return "Error";
    default:
      return current;
  }
}

function nextContext(state: ScanState, event: ScanEvent): ScanContext {
  switch (event.type) {
    case "LOCATION_SCANNED":
      return { ...state.context, locationCode: event.code, errorReason: undefined };
    case "PRODUCT_SCANNED":
      return { ...state.context, productCode: event.code, errorReason: undefined };
    case "VALIDATION_FAILED":
    case "SYNC_FAILED":
    case "FAIL":
      return { ...state.context, errorReason: event.reason };
    case "SCAN_AGAIN":
      return { locationCode: state.context.locationCode };
    case "RESET":
      return {};
    default:
      return state.context;
  }
}

export function isEventAllowed(state: ScanState, event: ScanEvent): boolean {
  return TRANSITIONS[state.name].includes(event.type);
}

/** Reducer puro: sin efectos, sin I/O, trivialmente testeable. */
export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  if (!isEventAllowed(state, event)) return state;
  return { name: nextName(state.name, event), context: nextContext(state, event) };
}
