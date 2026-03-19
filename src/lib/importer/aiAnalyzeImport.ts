// AI_GUARDRAIL: This service returns recommendations only.
// It must never directly mutate financial records.
import type { AIImportAnalyzer, AIImportPayload, AIImportResult } from "./types";
import { AI_MODEL } from "@/lib/ai-config";

const AI_SYSTEM_PROMPT = `You are an AI import-analysis engine for a property management platform called AtlasPM.
Your job is to analyze a spreadsheet sample (Excel or CSV) and determine how it should be imported into the AtlasPM database.
You must behave like a strict machine service, not a conversational assistant.
Return ONLY valid JSON. No markdown. No explanations outside the JSON.

Determine:
1. Most likely file type: atlas_template | yardi_rent_roll | tenant_list | arrears_report | building_list | violations_report | generic_property_data | unknown
2. Which rows are header rows
3. Which row real data begins on
4. Which rows to ignore (totals, subtotals, separators, blank rows, charge rows)
5. How each column maps to the AtlasPM schema
6. Confidence for each mapping (0-1)
7. Warnings and assumptions

Available schema fields for TENANTS:
unit, tenant_code, full_name, first_name, last_name, phone, email,
occupancy_status, move_in_date, move_out_date, lease_start_date,
lease_end_date, monthly_rent, market_rent, current_balance,
security_deposit, subsidy_amount, subsidy_type, arrears_status,
notes, building_id

Available schema fields for BUILDINGS:
building_id, address, zip, borough, block, lot, bin, units,
portfolio, entity, owner_name, property_manager, year_built,
floors, elevator, sprinkler_system, fire_alarm_system, oil_tank,
boiler_type, hpd_registration_id

Return exactly this JSON structure:
{
  "fileType": "string",
  "confidence": 0.0,
  "headerRows": [0],
  "dataStartRow": 1,
  "ignoredRowTypes": [],
  "ignoredRowIndices": [],
  "columns": [
    {
      "columnIndex": 0,
      "sourceHeader": "string",
      "normalizedHeader": "string",
      "mappedField": "string or null",
      "confidence": 0.0,
      "reason": "string"
    }
  ],
  "requiredFieldsStatus": {
    "missingRequiredFields": [],
    "presentRequiredFields": []
  },
  "warnings": [],
  "assumptions": []
}`;

/**
 * Create an Anthropic-based AI analyzer.
 * Returns null if ANTHROPIC_API_KEY is not set.
 */
export function createAnthropicAnalyzer(): AIImportAnalyzer | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  return {
    async analyze(payload: AIImportPayload): Promise<AIImportResult> {
      // Dynamic import to avoid bundling Anthropic SDK when not used
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });

      const message = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 4096,
        system: AI_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Analyze this spreadsheet for import into AtlasPM:\n\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from AI");
      }

      let raw = textBlock.text.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }

      let parsed: AIImportResult;
      try {
        parsed = JSON.parse(raw) as AIImportResult;
      } catch {
        throw new Error("AI returned invalid JSON. Please retry the import analysis.");
      }
      return parsed;
    },
  };
}
