import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

export function createRequestLogger(context: {
  userId?: string;
  organizationId?: string;
  requestId?: string;
  route?: string;
}) {
  return logger.child(context);
}

export default logger;
