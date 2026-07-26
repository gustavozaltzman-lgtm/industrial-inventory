import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { OperationsKpiGrid } from "@/components/operations/OperationsKpiGrid";
import { renderWithQuery } from "./renderWithQuery";
import { server } from "./setup";
import { errorHandlers } from "./mocks/mswHandlers";

const WAREHOUSE = "00000000-0000-0000-0000-000000000002";

describe("OperationsKpiGrid", () => {
  it("muestra el estado de carga mientras resuelve", () => {
    renderWithQuery(<OperationsKpiGrid warehouseId={WAREHOUSE} />);
    expect(screen.getByRole("status")).toHaveTextContent(/cargando/i);
  });

  it("renderiza las métricas cuando la API responde", async () => {
    renderWithQuery(<OperationsKpiGrid warehouseId={WAREHOUSE} />);

    expect(await screen.findByText("Throughput")).toBeInTheDocument();
    expect(screen.getByText("2.5")).toBeInTheDocument();
    expect(screen.getByText("Pendientes de sync")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("distingue 'sin dato' de cero: ocrErrorRate null no se muestra como 0", async () => {
    renderWithQuery(<OperationsKpiGrid warehouseId={WAREHOUSE} />);

    await screen.findByText("Error OCR");
    // El backend devolvió null para OCR y 0.01 para barcode: el panel debe
    // mostrar un guion, no un cero que se leeria como "sin errores".
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getAllByText("Sin dato disponible").length).toBeGreaterThan(0);
    expect(screen.getByText("1.00")).toBeInTheDocument();
  });

  it("expone las métricas como grupo accesible", async () => {
    renderWithQuery(<OperationsKpiGrid warehouseId={WAREHOUSE} />);

    const group = await screen.findByRole("group", { name: /últimos 60 minutos/i });
    expect(group).toBeInTheDocument();
  });

  it("muestra el estado Unauthorized ante un 401, sin ofrecer reintentar", async () => {
    server.use(errorHandlers.kpisUnauthorized);
    renderWithQuery(<OperationsKpiGrid warehouseId={WAREHOUSE} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/sin permisos/i);
    });
    // Reintentar no resolvería una falta de permisos.
    expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument();
  });

  // Un 504 sí se reintenta (a diferencia del 401): el hook hace dos intentos
  // con backoff antes de rendirse, así que el estado de error tarda unos
  // segundos en aparecer. El timeout ampliado refleja ese comportamiento real
  // en vez de enmascararlo desactivando los reintentos.
  const RETRY_WINDOW = { timeout: 8_000 };

  it("distingue un timeout de un fallo genérico y sugiere reintentar", async () => {
    server.use(errorHandlers.kpisTimeout);
    renderWithQuery(<OperationsKpiGrid warehouseId={WAREHOUSE} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/no respondió a tiempo/i);
    }, RETRY_WINDOW);
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("anuncia los errores de forma assertive para lectores de pantalla", async () => {
    server.use(errorHandlers.kpisTimeout);
    renderWithQuery(<OperationsKpiGrid warehouseId={WAREHOUSE} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "assertive");
    }, RETRY_WINDOW);
  });

  it("muestra el estado vacío cuando no hubo actividad en la ventana", async () => {
    server.use(errorHandlers.kpisEmpty);
    renderWithQuery(<OperationsKpiGrid warehouseId={WAREHOUSE} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/no hubo actividad/i);
    });
  });
});
