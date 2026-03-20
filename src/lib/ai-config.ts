// AtlasPM AI configuration — model and token limits for AI-powered features.
export const AI_MODEL = (process.env.ATLAS_AI_MODEL || "claude-sonnet-4-5-20251101") as string;
export const AI_MAX_TOKENS = 1000;
