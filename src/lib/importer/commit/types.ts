/** Shared types for all commit handlers */

export interface CommitResult {
  imported: number;
  skipped: number;
  errors: string[];
  tenantsCreated?: number;
  buildingsMatched?: number;
  unmatchedCodes?: string[];
}

export interface CommitContext {
  importBatchId: string;
  userId: string;
  organizationId?: string;
}
