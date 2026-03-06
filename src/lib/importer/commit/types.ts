/** Shared types for all commit handlers */

export interface CommitResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface CommitContext {
  importBatchId: string;
  userId: string;
}
