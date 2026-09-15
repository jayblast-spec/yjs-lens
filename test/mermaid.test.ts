import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { summarizeUpdate } from "../src/update-summary.js";
import { updateSummaryToMermaid } from "../src/mermaid.js";

function newDoc(clientID: number): Y.Doc {
  const doc = new Y.Doc();
  doc.clientID = clientID;
  return doc;
}

describe("updateSummaryToMermaid", () => {
  it("produces one node per contributing client, linked from a shared 'update' root", () => {
    const docA = newDoc(1);
    docA.getMap("data").set("from", "a");
    const docB = newDoc(2);
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    docB.getMap("data").set("from", "b");

    const summary = summarizeUpdate(Y.encodeStateAsUpdate(docB));
    const mermaid = updateSummaryToMermaid(summary);

    expect(mermaid).toMatch(/^graph LR/);
    expect(mermaid).toContain("client 1");
    expect(mermaid).toContain("client 2");
    const edgeCount = (mermaid.match(/-->/g) ?? []).length;
    expect(edgeCount).toBe(summary.clients.length);
  });

  it("produces a valid (if sparse) graph for a single-client update", () => {
    const doc = newDoc(42);
    doc.getMap("m").set("x", 1);
    const mermaid = updateSummaryToMermaid(summarizeUpdate(Y.encodeStateAsUpdate(doc)));
    expect(mermaid).toMatch(/^graph LR/);
    expect(mermaid).toContain("client 42");
  });
});
