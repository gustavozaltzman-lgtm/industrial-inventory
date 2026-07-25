import { InventoryEventRepository } from "../ports/inventory-event-repository.port.js";
import { createStockAdjustmentEvent } from "../events/inventory-scan-event.js";
import { InventoryScanEvent } from "../schemas/inventory-scan-event.schema.js";
import { EntityId, TenantId } from "../schemas/common.schema.js";

export interface AdjustStockInput {
  tenantId: TenantId;
  originalEventId: EntityId;
  adjustedQuantity: number;
  operatorId: EntityId;
  capturedAt: string;
  reasonMetadata?: Record<string, unknown>;
}

export class OriginalEventNotFoundError extends Error {
  constructor(eventId: string) {
    super(`InventoryScanEvent ${eventId} not found for tenant`);
    this.name = "OriginalEventNotFoundError";
  }
}

export class AdjustStockUseCase {
  constructor(private readonly repository: InventoryEventRepository) {}

  async execute(input: AdjustStockInput): Promise<InventoryScanEvent> {
    const originalEvent = await this.repository.findById(
      input.tenantId,
      input.originalEventId,
    );

    if (!originalEvent) {
      throw new OriginalEventNotFoundError(input.originalEventId);
    }

    const adjustment = createStockAdjustmentEvent({
      originalEvent,
      adjustedQuantity: input.adjustedQuantity,
      operatorId: input.operatorId,
      capturedAt: input.capturedAt,
      reasonMetadata: input.reasonMetadata,
    });

    await this.repository.append(adjustment);
    return adjustment;
  }
}
