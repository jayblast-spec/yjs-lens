/**
 * Two replicas concurrently edit a shared Y.Map, then we verify the
 * convergence guarantee actually held for the resulting updates, and
 * summarize who contributed what. Run with: npx tsx examples/demo.ts
 */
import * as Y from "yjs";
import { summarizeUpdate, checkConvergence } from "../src/index.js";

function newDoc(clientID: number): Y.Doc {
  const doc = new Y.Doc();
  doc.clientID = clientID;
  return doc;
}

const docA = newDoc(1);
docA.getMap("post").set("title", "Hello local-first");

const docB = newDoc(2);
Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
docB.getMap("post").set("author", "bob");

Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
docA.getMap("post").set("published", true);

const finalUpdate = Y.encodeStateAsUpdate(docA);

console.log("=== Update summary ===");
for (const c of summarizeUpdate(finalUpdate).clients) {
  console.log(`client ${c.client}: clock ${c.fromClock} -> ${c.toClock} (${c.opsCount} op(s))`);
}

console.log("\n=== Convergence check ===");
const earlierUpdate = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(newDoc(2)));
const result = checkConvergence([finalUpdate, earlierUpdate], { orderings: 20 });
console.log(`Converged: ${result.converged} (tried ${result.orderingsTried} random application orders)`);
console.log(`Final content: ${JSON.stringify(docA.getMap("post").toJSON())}`);
