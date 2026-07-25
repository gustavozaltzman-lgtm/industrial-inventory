import { describe, expect, it } from "vitest";
import { initialScanState, scanReducer, type ScanState } from "../engine/ScanStateMachine.js";

function run(events: Parameters<typeof scanReducer>[1][], from: ScanState = initialScanState) {
  return events.reduce(scanReducer, from);
}

describe("ScanStateMachine", () => {
  it("recorre el camino feliz hasta Completed", () => {
    const state = run([
      { type: "OPEN_CAMERA" },
      { type: "CAMERA_READY" },
      { type: "LOCATION_SCANNED", code: "A-01-02" },
      { type: "PRODUCT_SCANNED", code: "7790001" },
      { type: "VALIDATE" },
      { type: "VALIDATION_OK" },
      { type: "SAVED_LOCAL" },
      { type: "SYNC_STARTED" },
      { type: "SYNC_OK" },
    ]);

    expect(state.name).toBe("Completed");
    expect(state.context.locationCode).toBe("A-01-02");
    expect(state.context.productCode).toBe("7790001");
  });

  it("ignora eventos fuera de orden en vez de corromper el estado", () => {
    // Un lector industrial puede disparar repetido; el estado no debe saltar.
    const state = run([{ type: "SYNC_OK" }, { type: "SAVED_LOCAL" }]);
    expect(state.name).toBe("Idle");
  });

  it("un fallo de sync vuelve a PendingSync, no pierde el evento", () => {
    const state = run([
      { type: "OPEN_CAMERA" },
      { type: "CAMERA_READY" },
      { type: "PRODUCT_SCANNED", code: "7790001" },
      { type: "VALIDATE" },
      { type: "VALIDATION_OK" },
      { type: "SAVED_LOCAL" },
      { type: "SYNC_STARTED" },
      { type: "SYNC_FAILED", reason: "sin red" },
    ]);

    expect(state.name).toBe("PendingSync");
    expect(state.context.errorReason).toBe("sin red");
  });

  it("una validación fallida lleva a Error y RESET limpia el contexto", () => {
    const failed = run([
      { type: "OPEN_CAMERA" },
      { type: "CAMERA_READY" },
      { type: "PRODUCT_SCANNED", code: "9999" },
      { type: "VALIDATE" },
      { type: "VALIDATION_FAILED", reason: "código desconocido" },
    ]);
    expect(failed.name).toBe("Error");
    expect(failed.context.errorReason).toBe("código desconocido");

    const reset = scanReducer(failed, { type: "RESET" });
    expect(reset.name).toBe("Idle");
    expect(reset.context).toEqual({});
  });

  it("SCAN_AGAIN conserva la ubicación pero limpia el producto", () => {
    const state = run([
      { type: "OPEN_CAMERA" },
      { type: "CAMERA_READY" },
      { type: "LOCATION_SCANNED", code: "A-01-02" },
      { type: "PRODUCT_SCANNED", code: "7790001" },
      { type: "VALIDATE" },
      { type: "VALIDATION_OK" },
      { type: "SAVED_LOCAL" },
      { type: "SCAN_AGAIN" },
    ]);

    expect(state.name).toBe("Scanning");
    expect(state.context.locationCode).toBe("A-01-02");
    expect(state.context.productCode).toBeUndefined();
  });
});
