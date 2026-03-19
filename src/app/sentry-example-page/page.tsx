"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
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
          const error = new Error("Sentry frontend test error");
          Sentry.captureException(error);
          throw error;
        }}
      >
        Throw Test Error
      </button>
    </div>
  );
}
