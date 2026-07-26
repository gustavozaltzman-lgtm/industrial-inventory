import { describe, expect, it } from "vitest";
import { computeBackoffMs, DEFAULT_BACKOFF } from "../services/sync/QueueManager";

describe("computeBackoffMs", () => {
  it("crece con cada intento", () => {
    const first = computeBackoffMs(0);
    const later = computeBackoffMs(4);
    expect(later).toBeGreaterThan(first);
  });

  it("nunca supera el techo configurado", () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      expect(computeBackoffMs(attempt)).toBeLessThanOrEqual(DEFAULT_BACKOFF.maxDelayMs);
    }
  });

  it("siempre devuelve una espera positiva", () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      expect(computeBackoffMs(attempt)).toBeGreaterThan(0);
    }
  });

  it("aplica jitter: dos cálculos del mismo intento difieren", () => {
    // Sin jitter, 40 equipos reconectando juntos golpearían el backend en el
    // mismo milisegundo.
    const samples = new Set(Array.from({ length: 30 }, () => computeBackoffMs(5)));
    expect(samples.size).toBeGreaterThan(1);
  });
});
