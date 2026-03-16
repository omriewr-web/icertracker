import pino from "pino";

let logger: pino.Logger;

try {
  logger = pino({
    level: process.env.LOG_LEVEL || "info",
    ...(process.env.NODE_ENV === "development" && {
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    }),
  });
} catch {
  // Pino failed to initialize — fall back to console-based stub
  logger = {
    info: (...args: unknown[]) => { try { console.log(...args); } catch {} },
    warn: (...args: unknown[]) => { try { console.warn(...args); } catch {} },
    error: (...args: unknown[]) => { try { console.error(...args); } catch {} },
    debug: (...args: unknown[]) => { try { console.debug(...args); } catch {} },
    fatal: (...args: unknown[]) => { try { console.error(...args); } catch {} },
    trace: (...args: unknown[]) => { try { console.trace(...args); } catch {} },
    child: () => logger,
    level: "info",
  } as unknown as pino.Logger;
}

export function createRequestLogger(context: {
  userId?: string;
  organizationId?: string;
  requestId?: string;
  route?: string;
}) {
  try {
    return logger.child(context);
  } catch {
    return logger;
  }
}

export default logger;
