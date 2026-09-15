import { parseUpdateMeta } from "yjs";

export interface ClientContribution {
  client: number;
  fromClock: number;
  toClock: number;
  opsCount: number;
}

export interface UpdateSummary {
  clients: ClientContribution[];
}

/**
 * Summarizes which clients contributed which clock ranges to a Yjs update --
 * Yjs represents causal history as per-client (clock) ranges rather than
 * Automerge-style discrete named changes, so this is the closest equivalent
 * "what happened, and who did it" view available from the stable public API.
 */
export function summarizeUpdate(update: Uint8Array): UpdateSummary {
  const { from, to } = parseUpdateMeta(update);
  const clients: ClientContribution[] = [];
  for (const [client, fromClock] of from) {
    const toClock = to.get(client) ?? fromClock;
    clients.push({ client, fromClock, toClock, opsCount: toClock - fromClock });
  }
  return { clients: clients.sort((a, b) => a.client - b.client) };
}
