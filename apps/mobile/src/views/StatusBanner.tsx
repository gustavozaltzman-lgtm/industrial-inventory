import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ScanState, ScanStateName } from "../engine/ScanStateMachine.js";

const STATE_LABEL: Record<ScanStateName, string> = {
  Idle: "Listo",
  OpeningCamera: "Abriendo cámara…",
  Scanning: "Escaneando",
  LocationDetected: "Ubicación detectada",
  ProductDetected: "Producto detectado",
  Validating: "Validando…",
  SavingLocal: "Guardando local…",
  PendingSync: "Guardado — pendiente de sync",
  Syncing: "Sincronizando…",
  Completed: "Sincronizado",
  Error: "Error",
};

const STATE_COLOR: Partial<Record<ScanStateName, string>> = {
  Error: "#fee2e2",
  Completed: "#d1fae5",
  PendingSync: "#fef3c7",
};

export const StatusBanner = memo(function StatusBanner({
  state,
  pendingCount,
  onReset,
}: {
  state: ScanState;
  pendingCount: number;
  onReset: () => void;
}) {
  return (
    <View style={[styles.banner, { backgroundColor: STATE_COLOR[state.name] ?? "#f3f4f6" }]}>
      <View style={styles.textBlock}>
        <Text style={styles.state}>{STATE_LABEL[state.name]}</Text>
        {state.context.errorReason ? (
          <Text style={styles.reason}>{state.context.errorReason}</Text>
        ) : (
          <Text style={styles.reason}>{pendingCount} pendientes en cola local</Text>
        )}
      </View>
      {state.name === "Error" && (
        <Pressable onPress={onReset} style={styles.resetButton}>
          <Text style={styles.resetLabel}>Reintentar</Text>
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    padding: 12,
  },
  textBlock: { flex: 1, gap: 2 },
  state: { fontSize: 15, fontWeight: "700" },
  reason: { fontSize: 12, color: "#4b5563" },
  resetButton: { paddingHorizontal: 12, paddingVertical: 6 },
  resetLabel: { color: "#1d4ed8", fontWeight: "600" },
});
