import type { OutboundStore } from "./store";
import { MemoryOutboundStore } from "./store";
import { SupabaseOutboundStore } from "./supabaseStore";

let overrideStore: OutboundStore | null = null;
let memoryStore: OutboundStore | null = null;
let productionStore: OutboundStore | null = null;

/** Selects persistent storage in production and an isolated in-memory store only in tests. */
export function getOutboundStore(): OutboundStore {
  if (overrideStore) return overrideStore;

  if (process.env.NODE_ENV === "test" || process.env.OUTBOUND_MEMORY_STORE === "true") {
    memoryStore ??= new MemoryOutboundStore();
    return memoryStore;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Outbound requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  }

  productionStore ??= new SupabaseOutboundStore();
  return productionStore;
}

export function setOutboundStoreForTesting(store: OutboundStore | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("El override del store solo está permitido en NODE_ENV=test.");
  }
  overrideStore = store;
}
