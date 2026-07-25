import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { InventoryScanEvent } from "@indinv/core-domain";

const STATUS_COLOR: Record<InventoryScanEvent["syncStatus"], string> = {
  pending_sync: "#d97706",
  synced: "#059669",
  sync_failed: "#dc2626",
};

/**
 * memo() es deliberado: en una toma de inventario la lista crece a cientos de
 * filas y cada captura dispara un render del padre. Sin esto se re-renderiza
 * toda la lista por cada escaneo.
 */
export const ScanRow = memo(function ScanRow({ event }: { event: InventoryScanEvent }) {
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={styles.qty}>{event.quantity} u.</Text>
        <Text style={styles.meta}>
          #{event.sequenceNumber ?? "—"} · {event.captureSource}
        </Text>
      </View>
      <Text style={[styles.status, { color: STATUS_COLOR[event.syncStatus] }]}>
        {event.syncStatus}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  main: { gap: 2 },
  qty: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 12, color: "#6b7280" },
  status: { fontSize: 12, fontWeight: "600" },
});
