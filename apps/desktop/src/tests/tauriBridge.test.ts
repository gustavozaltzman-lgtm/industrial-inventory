import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";

// `emit()` de @tauri-apps/api/event manda eventos frontend -> backend; no
// sirve para simular uno que Rust dispara hacia el WebView, y mocks.js no
// expone un helper para eso (requeriría reproducir la plomería interna de
// transformCallback). Se mockea `listen` directamente para poder invocar el
// callback registrado a mano y así verificar la traducción snake_case ->
// camelCase, que es lo que realmente importa comprobar acá.
const listenMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

// isTauri() de @tauri-apps/api evalúa `!!window.isTauri` — un booleano que el
// runtime real inyecta al arrancar, no una función. mockIPC() se encarga de
// poblar __TAURI_INTERNALS__ por su cuenta; si se lo predefine acá sin
// `writable: true`, esa asignación interna falla en modo estricto.
beforeEach(() => {
  Object.defineProperty(window, "isTauri", { value: true, writable: true, configurable: true });
});

afterEach(() => {
  clearMocks();
  vi.resetModules();
  listenMock.mockReset();
  // @ts-expect-error -- limpieza del shim entre tests
  delete window.__TAURI_INTERNALS__;
});

describe("tauriBridge — runtime nativo", () => {
  it("listSerialPorts traduce snake_case a camelCase", async () => {
    mockIPC((cmd) => {
      if (cmd === "list_serial_ports") {
        return [
          { port_name: "COM3", kind: "UsbPort" },
          { port_name: "COM5", kind: "PciPort" },
        ];
      }
      throw new Error(`comando inesperado: ${cmd}`);
    });

    const { tauriBridge } = await import("../services/tauriBridge");
    const ports = await tauriBridge.listSerialPorts();

    expect(ports).toEqual([
      { portName: "COM3", kind: "UsbPort" },
      { portName: "COM5", kind: "PciPort" },
    ]);
  });

  it("connectSerialPort invoca el comando con los argumentos correctos", async () => {
    const received: unknown[] = [];
    mockIPC((cmd, args) => {
      if (cmd === "connect_serial_port") {
        received.push(args);
        return null;
      }
    });

    const { tauriBridge } = await import("../services/tauriBridge");
    await tauriBridge.connectSerialPort("COM3", 19200);

    expect(received).toEqual([{ portName: "COM3", baudRate: 19200 }]);
  });

  it("getDbStats traduce snake_case a camelCase", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_db_stats") {
        return {
          path: "/data/indinv-desktop.sqlite",
          size_bytes: 2048,
          pending_events: 7,
          captured_photos: 3,
        };
      }
    });

    const { tauriBridge } = await import("../services/tauriBridge");
    const stats = await tauriBridge.getDbStats();

    expect(stats).toEqual({
      path: "/data/indinv-desktop.sqlite",
      sizeBytes: 2048,
      pendingEvents: 7,
      capturedPhotos: 3,
    });
  });

  it("onHardwareScan se suscribe al canal correcto y traduce el payload", async () => {
    const unlistenSpy = vi.fn();
    listenMock.mockResolvedValue(unlistenSpy);

    const { tauriBridge } = await import("../services/tauriBridge");
    const received: unknown[] = [];
    const unlisten = await tauriBridge.onHardwareScan((event) => received.push(event));

    expect(listenMock).toHaveBeenCalledWith("hardware-scan", expect.any(Function));

    // Simula a Rust emitiendo el evento: se invoca a mano el callback que
    // tauriBridge le pasó a listen(), con la forma real que produce Tauri
    // ({ event, id, payload }).
    const handler = listenMock.mock.calls[0]![1] as (e: { payload: unknown }) => void;
    handler({ payload: { port_name: "COM3", raw: "789123456", received_at_ms: 42 } });

    expect(received).toEqual([{ portName: "COM3", raw: "789123456", receivedAtMs: 42 }]);

    await unlisten();
    expect(unlistenSpy).toHaveBeenCalledOnce();
  });
});

describe("tauriBridge — navegador (fuera de Tauri)", () => {
  beforeEach(() => {
    // @ts-expect-error -- simula la ausencia del runtime nativo
    delete window.__TAURI_INTERNALS__;
    Object.defineProperty(window, "isTauri", { value: false, writable: true, configurable: true });
  });

  it("degrada a listas vacías en vez de lanzar", async () => {
    const { tauriBridge } = await import("../services/tauriBridge");

    await expect(tauriBridge.listSerialPorts()).resolves.toEqual([]);
    await expect(tauriBridge.connectedSerialPorts()).resolves.toEqual([]);
  });

  it("rechaza operaciones que exigen el runtime nativo con un error claro", async () => {
    const { tauriBridge } = await import("../services/tauriBridge");

    await expect(tauriBridge.connectSerialPort("COM3")).rejects.toThrow(/escritorio/);
    await expect(tauriBridge.initDb()).rejects.toThrow(/escritorio/);
  });
});
