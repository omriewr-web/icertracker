export class ApiRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
  }
}

export class ApiValidationError extends ApiRequestError {
  constructor(details: unknown) {
    super("Validation failed", 400, details);
    this.name = "ApiValidationError";
  }
}
