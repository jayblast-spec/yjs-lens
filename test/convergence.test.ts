import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { checkConvergence } from "../src/convergence.js";

function newDoc(clientID: number): Y.Doc {
  const doc = new Y.Doc();
  doc.clientID = clientID;
  return doc;
}

function collectUpdates(): Uint8Array[] {
  const docA = newDoc(1);
  const mapA = docA.getMap("data");
  mapA.set("title", "hello");

  const docB = newDoc(2);
  Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
  const mapB = docB.getMap("data");
  mapB.set("author", "bob");

  Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
  const mapA2 = docA.getMap("data");
  mapA2.set("published", true);

  // Two updates covering disjoint parts of history, from two diverged replicas.
  const updateFromB = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(newDoc(2)));
  const updateFromA = Y.encodeStateAsUpdate(docA);
  return [updateFromA, updateFromB];
}

describe("checkConvergence", () => {
  it("confirms convergence for a normal set of concurrent Y.Map edits, applied out of causal order", () => {
    const updates = collectUpdates();
    const result = checkConvergence(updates, { orderings: 15 });
    expect(result.converged).toBe(true);
    expect(result.orderingsTried).toBe(15);
  });

  it("is not fooled by Y.Map key-insertion-order differences across application orders (false-positive guard)", () => {
    const doc1 = newDoc(10);
    const map1 = doc1.getMap("m");
    map1.set("a", 1);
    map1.set("b", 2);
    map1.set("c", 3);
    const update1 = Y.encodeStateAsUpdate(doc1);

    // Same three keys, different client and insertion order -- when applied
    // after update1 in one order vs. the other, Yjs's internal key iteration
    // order for the resulting map can legitimately differ even though the
    // resulting key/value set is identical.
    const doc2 = newDoc(11);
    const map2 = doc2.getMap("m");
    map2.set("c", 3);
    map2.set("a", 1);
    map2.set("b", 2);
    const update2 = Y.encodeStateAsUpdate(doc2);

    const result = checkConvergence([update1, update2], { orderings: 15, seed: 99 });
    expect(result.converged).toBe(true);
  });

  it("is deterministic for a given seed", () => {
    const updates = collectUpdates();
    const a = checkConvergence(updates, { orderings: 8, seed: 7 });
    const b = checkConvergence(updates, { orderings: 8, seed: 7 });
    expect(a).toEqual(b);
  });

  it("detects and reports a genuine divergence when materialize disagrees across runs", () => {
    let call = 0;
    const doc = newDoc(1);
    doc.getMap("m").set("x", 1);
    const update = Y.encodeStateAsUpdate(doc);

    // A deliberately-broken materialize function to prove the detector
    // correctly flags and reports a mismatch when one occurs.
    const result = checkConvergence([update], {
      orderings: 5,
      materialize: () => (call++ === 0 ? { x: 1 } : { x: 2 }),
    });

    expect(result.converged).toBe(false);
    expect(result.divergence).toBeDefined();
    expect(result.divergence!.referenceState).toEqual({ x: 1 });
    expect(result.divergence!.divergentState).toEqual({ x: 2 });
  });

  it("handles an empty update set as trivially converged", () => {
    expect(checkConvergence([], { orderings: 5 }).converged).toBe(true);
  });
});
