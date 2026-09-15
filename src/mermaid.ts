import type { UpdateSummary } from "./update-summary.js";

function escapeLabel(text: string): string {
  return text.replace(/"/g, "&quot;");
}

/**
 * Renders an update summary as a Mermaid `graph LR` -- one node per
 * contributing client, sized (in label) by how many ops it contributed.
 * Paste the output into a ```mermaid fenced block anywhere that renders
 * Markdown (GitHub does this natively) to see who touched an update at a
 * glance, instead of reading a clock-range table.
 */
export function updateSummaryToMermaid(summary: UpdateSummary): string {
  const lines = ["graph LR", '  update(("update"))'];

  summary.clients.forEach((c, i) => {
    const id = `client${i}`;
    const label = escapeLabel(`client ${c.client}\\nclock ${c.fromClock}-${c.toClock}\\n${c.opsCount} op(s)`);
    lines.push(`  ${id}["${label}"]`);
    lines.push(`  update --> ${id}`);
  });

  return lines.join("\n");
}
