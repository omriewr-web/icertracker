/**
 * Normalize a raw header string for comparison.
 * - lowercase
 * - trim
 * - remove punctuation (keep alphanumeric and spaces)
 * - replace underscores/dashes with spaces
 * - collapse multiple spaces
 */
export function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[_\-]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Combine two header rows (for split/merged headers).
 * Row 1: ["Unit", "Unit Type", "", "Name", "Market", ...]
 * Row 2: ["",     "",          "", "",     "Rent",   ...]
 * Result: ["Unit", "Unit Type", "", "Name", "Market Rent", ...]
 */
export function combineHeaderRows(
  row1: (string | number | null)[],
  row2: (string | number | null)[],
): string[] {
  const maxLen = Math.max(row1.length, row2.length);
  const combined: string[] = [];
  for (let i = 0; i < maxLen; i++) {
    const a = String(row1[i] ?? "").trim();
    const b = String(row2[i] ?? "").trim();
    if (!a && !b) combined.push("");
    else if (!b) combined.push(a);
    else if (!a) combined.push(b);
    else combined.push(`${a} ${b}`);
  }
  return combined;
}
