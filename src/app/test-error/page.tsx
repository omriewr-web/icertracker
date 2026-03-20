"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

export default function TestErrorPage() {
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const triggerClientError = () => {
    const error = new Error("Sentry client-side test error from /test-error");
    Sentry.captureException(error);
    throw error;
  };

  const triggerServerError = async () => {
    setServerMessage(null);

    try {
      const response = await fetch("/api/sentry-example-route", {
        method: "GET",
      });

      if (!response.ok) {
        setServerMessage("Server test route returned an error as expected. Check Sentry for the event.");
      }
    } catch (error) {
      Sentry.captureException(error);
      setServerMessage("Server test route request failed. Check Sentry for the event.");
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center gap-6 px-6 py-16 text-slate-100">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
          Test Only
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Sentry verification page</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          This route exists only to verify that browser and server-side Sentry events are reaching
          your project. Remove or disable it after you confirm the integration.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 sm:grid-cols-2">
        <button
          type="button"
          onClick={triggerClientError}
          className="rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
        >
          Trigger Client Error
        </button>
        <button
          type="button"
          onClick={triggerServerError}
          className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Trigger Server Error
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm leading-6 text-slate-300">
        <p>
          Expected result: either button should create a visible Sentry event for the current
          environment.
        </p>
        {serverMessage ? <p className="mt-3 text-amber-300">{serverMessage}</p> : null}
      </div>
    </main>
  );
}
