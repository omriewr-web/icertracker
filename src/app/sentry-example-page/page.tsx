"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryExamplePage() {
  const [error, setError] = useState<Error | null>(null);

  // Throwing from state triggers React's error boundary → Sentry captures via global-error
  if (error) {
    throw error;
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Sentry Test Page</h1>
      <p>Click the button to throw a test error and verify Sentry is capturing events.</p>
      <button
        type="button"
        style={{
          marginTop: "1rem",
          padding: "0.75rem 1.5rem",
          background: "#c9a84c",
          color: "#0a1628",
          border: "none",
          borderRadius: "6px",
          fontWeight: 600,
          cursor: "pointer",
        }}
        onClick={() => {
          const err = new Error("Sentry test error from AtlasPM client");
          Sentry.captureException(err);
          setError(err);
        }}
      >
        Throw Test Error
      </button>
    </div>
  );
}
