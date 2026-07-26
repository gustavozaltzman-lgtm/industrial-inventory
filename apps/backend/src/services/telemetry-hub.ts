import type { TelemetryEvent } from "@indinv/core-domain";

type Subscriber = (event: TelemetryEvent) => void;

/**
 * Fan-out en memoria de eventos de telemetría, particionado por tenant para
 * que un suscriptor jamás reciba eventos de otro inquilino.
 *
 * Deliberadamente en memoria: con varias instancias de Render cada una tendría
 * sus propios suscriptores y un evento ingerido por la instancia A no llegaría
 * a un panel conectado a la B. Para escalar horizontalmente hay que
 * reemplazarlo por Redis pub/sub o Postgres LISTEN/NOTIFY — la interfaz no
 * cambia, solo esta implementación.
 */
export class TelemetryHub {
  private readonly subscribersByTenant = new Map<string, Set<Subscriber>>();

  subscribe(tenantId: string, subscriber: Subscriber): () => void {
    let set = this.subscribersByTenant.get(tenantId);
    if (!set) {
      set = new Set();
      this.subscribersByTenant.set(tenantId, set);
    }
    set.add(subscriber);

    return () => {
      set.delete(subscriber);
      if (set.size === 0) this.subscribersByTenant.delete(tenantId);
    };
  }

  publish(event: TelemetryEvent): void {
    const subscribers = this.subscribersByTenant.get(event.trace.tenantId);
    if (!subscribers) return;
    for (const subscriber of subscribers) subscriber(event);
  }

  subscriberCount(tenantId: string): number {
    return this.subscribersByTenant.get(tenantId)?.size ?? 0;
  }
}

export const telemetryHub = new TelemetryHub();
