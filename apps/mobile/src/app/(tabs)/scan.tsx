import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import type { InventoryScanEvent } from "@indinv/core-domain";
import { getContainer } from "../../composition/container";
import { initialScanState, scanReducer } from "../../engine/ScanStateMachine";
import { ScanRow } from "../../views/ScanRow";
import { StatusBanner } from "../../views/StatusBanner";

export default function ScanScreen() {
  // El grafo de dependencias se arma una vez; recrearlo por render tiraría
  // abajo la memoización de toda la pantalla.
  const container = useMemo(() => getContainer(), []);
  const { captureEngine, queue, sync, repository, tenantId, warehouseId } = container;

  const [state, dispatch] = useReducer(scanReducer, initialScanState);
  const [events, setEvents] = useState<InventoryScanEvent[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [barcode, setBarcode] = useState("");

  const refreshPending = useCallback(async () => {
    setPendingCount(await queue.countPending(tenantId));
  }, [queue, tenantId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const stored = await repository.listByWarehouse(tenantId, warehouseId);
      if (!active) return;
      setEvents(stored.slice().reverse());
      await refreshPending();
    })();

    // El engine notifica cada captura; así la lista se actualiza sin polling.
    const unsubscribe = captureEngine.subscribe((event) => {
      setEvents((current) => [event, ...current]);
      void refreshPending();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [captureEngine, repository, tenantId, warehouseId, refreshPending]);

  const handleCapture = useCallback(async () => {
    const code = barcode.trim();
    if (code.length === 0) return;

    dispatch({ type: "PRODUCT_SCANNED", code });
    dispatch({ type: "VALIDATE" });

    try {
      await captureEngine.captureScan({
        tenantId,
        warehouseId,
        barcode: code,
        quantity: 1,
        captureSource: "MANUAL",
      });
      dispatch({ type: "VALIDATION_OK" });
      dispatch({ type: "SAVED_LOCAL" });
      setBarcode("");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Error desconocido";
      dispatch({ type: "VALIDATION_FAILED", reason });
    }
  }, [barcode, captureEngine, tenantId, warehouseId]);

  const handleSync = useCallback(async () => {
    dispatch({ type: "SYNC_STARTED" });
    const result = await sync.syncNow();
    dispatch(
      result.failed > 0
        ? { type: "SYNC_FAILED", reason: `${result.failed} eventos no subieron` }
        : { type: "SYNC_OK" },
    );
    const stored = await repository.listByWarehouse(tenantId, warehouseId);
    setEvents(stored.slice().reverse());
    await refreshPending();
  }, [sync, repository, tenantId, warehouseId, refreshPending]);

  const handleReset = useCallback(() => dispatch({ type: "RESET" }), []);

  const renderItem = useCallback(
    ({ item }: { item: InventoryScanEvent }) => <ScanRow event={item} />,
    [],
  );
  const keyExtractor = useCallback((item: InventoryScanEvent) => item.id, []);

  return (
    <View style={styles.container}>
      <StatusBanner state={state} pendingCount={pendingCount} onReset={handleReset} />

      <View style={styles.captureRow}>
        <TextInput
          style={styles.input}
          value={barcode}
          onChangeText={setBarcode}
          placeholder="Código de barras"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void handleCapture()}
        />
        <Pressable style={styles.button} onPress={() => void handleCapture()}>
          <Text style={styles.buttonLabel}>Capturar</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.syncButton, pendingCount === 0 && styles.syncButtonDisabled]}
        disabled={pendingCount === 0}
        onPress={() => void handleSync()}
      >
        <Text style={styles.buttonLabel}>
          {pendingCount > 0 ? `Sincronizar ${pendingCount} pendientes` : "Todo sincronizado"}
        </Text>
      </Pressable>

      <FlashList
        data={events}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={64}
        ListEmptyComponent={<Text style={styles.empty}>Sin lecturas todavía.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  captureRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  syncButton: { backgroundColor: "#059669", borderRadius: 8, padding: 12, alignItems: "center" },
  syncButtonDisabled: { backgroundColor: "#9ca3af" },
  buttonLabel: { color: "#ffffff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#6b7280", paddingVertical: 24 },
});
