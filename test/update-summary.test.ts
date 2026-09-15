import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { summarizeUpdate } from "../src/update-summary.js";

function newDoc(clientID: number): Y.Doc {
  const doc = new Y.Doc();
  doc.clientID = clientID;
  return doc;
}

describe("summarizeUpdate", () => {
  it("reports the clock range for a single-client update", () => {
    const doc = newDoc(111);
    const map = doc.getMap("data");
    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);

    const update = Y.encodeStateAsUpdate(doc);
    const summary = summarizeUpdate(update);

    expect(summary.clients).toHaveLength(1);
    expect(summary.clients[0]!.client).toBe(111);
    expect(summary.clients[0]!.fromClock).toBe(0);
    expect(summary.clients[0]!.opsCount).toBeGreaterThan(0);
  });

  it("reports separate entries for each contributing client in a merged update", () => {
    const docA = newDoc(1);
    docA.getMap("data").set("from", "a");

    const docB = newDoc(2);
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    docB.getMap("data").set("from", "b");

    const merged = Y.encodeStateAsUpdate(docB);
    const summary = summarizeUpdate(merged);

    const clientIds = summary.clients.map((c) => c.client).sort((a, b) => a - b);
    expect(clientIds).toEqual([1, 2]);
  });

  it("returns clients sorted by client id", () => {
    const docA = newDoc(500);
    docA.getMap("m").set("x", 1);
    const docB = newDoc(3);
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    docB.getMap("m").set("y", 2);

    const summary = summarizeUpdate(Y.encodeStateAsUpdate(docB));
    expect(summary.clients.map((c) => c.client)).toEqual([3, 500]);
  });
});
