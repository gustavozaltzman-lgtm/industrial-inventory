import { InventoryEventRepository } from "../ports/inventory-event-repository.port.js";
import { createStockReadEvent, NewStockReadInput } from "../events/inventory-scan-event.js";
import { InventoryScanEvent } from "../schemas/inventory-scan-event.schema.js";

export class RecordScanUseCase {
  constructor(private readonly repository: InventoryEventRepository) {}

  async execute(input: NewStockReadInput): Promise<InventoryScanEvent> {
    const event = createStockReadEvent(input);
    await this.repository.append(event);
    return event;
  }

  async executeBatch(inputs: NewStockReadInput[]): Promise<InventoryScanEvent[]> {
    const events = inputs.map(createStockReadEvent);
    await this.repository.appendBatch(events);
    return events;
  }
}
