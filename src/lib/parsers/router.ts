import type { ParseResult } from "./types";
import { parseAtlasTemplate } from "./atlas-template.parser";
import { parseGenericAR } from "./generic-ar.parser";
import { parseAppFolio } from "./appfolio.parser";
import { parseDHCR } from "./dhcr.parser";
import { parseConEd } from "./coned.parser";

interface RouterResult extends ParseResult {
  parserUsed: string;
  confidence: number;
}

/**
 * Master parser router. Accepts a file buffer, runs all parsers,
 * and returns the result from the highest-confidence parser.
 */
export function routeParser(buffer: Buffer, filename: string): RouterResult {
  const results: ParseResult[] = [];

  // Try each parser, catch failures gracefully
  const parsers: Array<{ name: string; fn: (buf: Buffer) => ParseResult | null }> = [
    { name: "atlas-template", fn: parseAtlasTemplate },
    { name: "appfolio", fn: parseAppFolio },
    { name: "dhcr", fn: parseDHCR },
    { name: "coned", fn: parseConEd },
    { name: "generic-ar", fn: parseGenericAR },
  ];

  for (const parser of parsers) {
    try {
      const result = parser.fn(buffer);
      if (result && result.data.length > 0) {
        results.push(result);
      }
    } catch (err) {
      // Parser failed — skip silently, try next
    }
  }

  if (results.length === 0) {
    return {
      success: false,
      parserUsed: "none",
      confidence: 0,
      data: [],
      errors: [{ row: 0, field: "file", reason: "Unrecognized file format. Please use an AtlasPM template or a supported format (Yardi, AppFolio, DHCR, ConEd)." }],
      warnings: [],
    };
  }

  // Pick highest confidence
  results.sort((a, b) => b.confidence - a.confidence);
  const best = results[0];

  if (best.confidence < 60) {
    return {
      ...best,
      success: false,
      errors: [{ row: 0, field: "file", reason: "Unrecognized file format — confidence too low." }],
    };
  }

  if (best.confidence < 80) {
    best.warnings = [...best.warnings, "Low confidence detection — please verify the data before importing."];
  }

  return best as RouterResult;
}
