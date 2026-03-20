import * as Sentry from "@sentry/nextjs";

type ScopeOptions = {
  level?: Sentry.SeverityLevel;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
};

export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown error", {
    cause: error,
  });
}

export function captureSentryException(error: unknown, options: ScopeOptions = {}) {
  const normalized = normalizeError(error);

  Sentry.withScope((scope) => {
    applyScopeOptions(scope, options);
    Sentry.captureException(normalized);
  });

  return normalized;
}

export function captureBusinessMessage(
  message: string,
  options: ScopeOptions = {},
) {
  Sentry.withScope((scope) => {
    applyScopeOptions(scope, options);
    Sentry.captureMessage(message, options.level ?? "error");
  });
}

export function startObservedServerSpan<T>(
  name: string,
  op: string,
  callback: () => Promise<T>,
) {
  return Sentry.startSpan(
    {
      name,
      op,
    },
    callback,
  );
}

export function captureSlowRoute(params: {
  route: string;
  method: string;
  durationMs: number;
  userId?: string | null;
  organizationId?: string | null;
  requestId?: string;
  thresholdMs?: number;
}) {
  const thresholdMs = params.thresholdMs ?? 1500;
  if (params.durationMs < thresholdMs) {
    return;
  }

  captureBusinessMessage("Slow API route detected", {
    level: "warning",
    tags: {
      route: params.route,
      method: params.method,
      userId: params.userId,
      organizationId: params.organizationId,
      requestId: params.requestId,
    },
    extra: {
      durationMs: params.durationMs,
      thresholdMs,
    },
    fingerprint: ["slow-api-route", params.method, params.route],
  });
}

function applyScopeOptions(scope: Sentry.Scope, options: ScopeOptions) {
  if (options.level) {
    scope.setLevel(options.level);
  }

  if (options.fingerprint?.length) {
    scope.setFingerprint(options.fingerprint);
  }

  for (const [key, value] of Object.entries(options.tags ?? {})) {
    if (value !== undefined && value !== null) {
      scope.setTag(key, String(value));
    }
  }

  for (const [key, value] of Object.entries(options.extra ?? {})) {
    if (value !== undefined) {
      scope.setExtra(key, value);
    }
  }
}
