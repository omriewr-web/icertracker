"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            background: "#0a1628",
            color: "#fff",
          }}
        >
          <h2 style={{ color: "#e05c5c", fontSize: "1.5rem", marginBottom: "1rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.5rem",
              background: "#c9a84c",
              color: "#0a1628",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
