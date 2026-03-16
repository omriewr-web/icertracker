export const FEATURES = {
  COEUS_ENABLED: process.env.FEATURE_COEUS !== "false",
  THEMIS_ENABLED: process.env.FEATURE_THEMIS !== "false",
  ATLAS_COMMUNICATE_ENABLED: process.env.FEATURE_COMMUNICATE === "true",
  ATLAS_INBOX_ENABLED: process.env.FEATURE_INBOX === "true",
  ARGUS_MAP_ENABLED: process.env.FEATURE_ARGUS_MAP !== "false",
  PROJECT_TRACKER_ENABLED: process.env.FEATURE_PROJECT_TRACKER !== "false",
} as const;

export function isEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}
