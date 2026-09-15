import * as Y from "yjs";

export interface ConvergenceResult {
  converged: boolean;
  orderingsTried: number;
  divergence?: { referenceState: unknown; divergentState: unknown };
}

export interface CheckConvergenceOptions {
  orderings?: number;
  seed?: number;
  /**
   * How to materialize a doc's content for comparison. Defaults to the
   * deprecated-but-functional `Doc.toJSON()`, which recursively serializes
   * every shared type the doc knows about. Pass your own for docs with
   * root types you'd rather not rely on that deprecated method for.
   */
  materialize?: (doc: Y.Doc) => unknown;
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// mulberry32: a small deterministic PRNG so a failing run is reproducible from its seed.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function defaultMaterialize(doc: Y.Doc): unknown {
  return doc.toJSON();
}

/**
 * Recursively sorts object keys so two logically-equal materialized states
 * compare equal even if their (JS engine-dependent) key insertion order
 * differs -- e.g. a Y.Map whose keys were set in a different order across
 * two application orderings. Arrays keep their order, since order is
 * semantically meaningful there.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Applies a flat set of updates (gathered from any number of diverged
 * replicas) to fresh docs in many random orders, and asserts every ordering
 * converges to the same materialized content. Yjs is explicitly designed to
 * accept updates out of causal order, so this exercises a real code path,
 * not a contrived one. Compares materialized *content*, not raw encoded
 * bytes -- two docs can be logically identical while their internal struct
 * representation differs, so a byte-level comparison would produce false
 * positives.
 */
export function checkConvergence(updates: Uint8Array[], options: CheckConvergenceOptions = {}): ConvergenceResult {
  const orderings = options.orderings ?? 20;
  const rand = mulberry32(options.seed ?? 42);
  const materialize = options.materialize ?? defaultMaterialize;

  let referenceState: unknown;
  let referenceJson: string | undefined;

  for (let i = 0; i < orderings; i++) {
    const order = shuffle(updates, rand);
    const doc = new Y.Doc();
    for (const update of order) Y.applyUpdate(doc, update);
    const state = materialize(doc);
    const json = JSON.stringify(canonicalize(state));

    if (referenceJson === undefined) {
      referenceState = state;
      referenceJson = json;
      continue;
    }

    if (json !== referenceJson) {
      return { converged: false, orderingsTried: i + 1, divergence: { referenceState, divergentState: state } };
    }
  }

  return { converged: true, orderingsTried: orderings };
}
