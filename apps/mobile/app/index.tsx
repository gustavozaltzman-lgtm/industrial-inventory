import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { InventoryScanEvent } from "@indinv/core-domain";
import { createStockReadEvent } from "@indinv/core-domain";
import { db, initLocalDb } from "../src/db/client.js";
import { SqliteInventoryEventRepository } from "../src/adapters/sqlite-inventory-event.repository.js";

const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_WAREHOUSE_ID = "00000000-0000-0000-0000-000000000002";
const DEMO_SKU_ID = "00000000-0000-0000-0000-000000000003";

export default function ScanScreen() {
  const [events, setEvents] = useState<InventoryScanEvent[]>([]);

  useEffect(() => {
    initLocalDb();
    void refresh();
  }, []);

  async function refresh() {
    const repository = new SqliteInventoryEventRepository(db);
    const pending = await repository.findPendingSync(DEMO_TENANT_ID);
    setEvents(pending);
  }

  async function simulateScan() {
    const repository = new SqliteInventoryEventRepository(db);
    const event = createStockReadEvent({
      tenantId: DEMO_TENANT_ID,
      warehouseId: DEMO_WAREHOUSE_ID,
      skuId: DEMO_SKU_ID,
      quantity: 1,
      captureSource: "MANUAL",
      capturedAt: new Date().toISOString(),
    });
    await repository.append(event);
    await refresh();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.button} onPress={() => void simulateScan()}>
        + Registrar lectura (demo)
      </Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text>
              {item.quantity} u. · {item.captureSource} · {item.syncStatus}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  button: { fontSize: 16, color: "#2563eb", marginBottom: 16 },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
});
