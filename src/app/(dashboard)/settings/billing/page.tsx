"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  Calendar,
  FileText,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

interface BillingStatus {
  unitCount: number;
  pricePerUnit: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

// ── Data hook ──────────────────────────────────────────────────

function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ["billing-status"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status");
      if (!res.ok) throw new Error("Failed to fetch billing status");
      return res.json();
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type StatusVariant = "active" | "trialing" | "past_due" | "canceled" | "unknown";

function getStatusVariant(status: string | null): StatusVariant {
  if (!status) return "unknown";
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "canceled";
  return "unknown";
}

function StatusBadge({ status }: { status: string | null }) {
  const variant = getStatusVariant(status);
  const labels: Record<StatusVariant, string> = {
    active: "Active",
    trialing: "Trialing",
    past_due: "Past Due",
    canceled: "Canceled",
    unknown: "No Subscription",
  };
  const colors: Record<StatusVariant, string> = {
    active: "bg-[#4caf82]/15 text-[#4caf82] border-[#4caf82]/30",
    trialing: "bg-accent/15 text-accent border-accent/30",
    past_due: "bg-[#e05c5c]/15 text-[#e05c5c] border-[#e05c5c]/30",
    canceled: "bg-[#e05c5c]/15 text-[#e05c5c] border-[#e05c5c]/30",
    unknown: "bg-text-dim/15 text-text-dim border-text-dim/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${colors[variant]}`}
    >
      {labels[variant]}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function BillingPage() {
  const { data: billing, isLoading, error } = useBillingStatus();

  const monthlyTotal = billing
    ? billing.unitCount * billing.pricePerUnit
    : 0;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-wide text-text-primary">
          Billing
        </h1>
        <p className="text-sm text-text-muted mt-0.5">
          Manage your subscription and view invoices.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center text-text-dim py-12">
          Loading billing information...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-[#e05c5c] text-sm">
          <AlertTriangle className="w-4 h-4" />
          Failed to load billing information.
        </div>
      )}

      {billing && (
        <>
          {/* Current Plan Card */}
          <div className="rounded-xl border border-border bg-atlas-navy-2 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    Current Plan
                  </h2>
                  <p className="text-xs text-text-muted">Per-unit pricing</p>
                </div>
              </div>
              <StatusBadge status={billing.subscriptionStatus} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
              {/* Units */}
              <div className="text-center sm:text-left">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                  Managed Units
                </p>
                <p className="text-4xl font-display font-bold text-text-primary tracking-wide">
                  {billing.unitCount}
                </p>
              </div>

              {/* Rate */}
              <div className="text-center sm:text-left">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                  Per Unit / Month
                </p>
                <p className="text-4xl font-display font-bold text-accent tracking-wide">
                  {formatCurrency(billing.pricePerUnit)}
                </p>
              </div>

              {/* Monthly Total */}
              <div className="text-center sm:text-left">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                  Monthly Total
                </p>
                <p className="text-4xl font-display font-bold text-text-primary tracking-wide">
                  {formatCurrency(monthlyTotal)}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border text-xs text-text-dim">
              {billing.unitCount} units x {formatCurrency(billing.pricePerUnit)}/unit = {formatCurrency(monthlyTotal)}/month
            </div>
          </div>

          {/* Next Billing Date */}
          <div className="rounded-xl border border-border bg-atlas-navy-2 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Next Billing Date
                </h2>
                {billing.currentPeriodEnd ? (
                  <p className="text-sm text-text-muted">
                    {formatDate(billing.currentPeriodEnd)}
                  </p>
                ) : (
                  <p className="text-sm text-text-dim">
                    No active billing period
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Connect Stripe */}
          <div className="rounded-xl border border-border bg-atlas-navy-2 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    Payment Method
                  </h2>
                  <p className="text-sm text-text-muted">
                    Connect Stripe to manage your subscription and payment method.
                  </p>
                </div>
              </div>
              <div className="relative group">
                <button
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent opacity-60 cursor-not-allowed"
                >
                  <CreditCard className="w-4 h-4" />
                  Connect Stripe
                </button>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                  <div className="rounded-lg bg-atlas-navy-3 border border-border px-3 py-2 text-xs text-text-muted shadow-lg whitespace-nowrap">
                    Coming soon
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice History */}
          <div className="rounded-xl border border-border bg-atlas-navy-2 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Invoice History
                </h2>
                <p className="text-xs text-text-muted">
                  Past invoices and receipts
                </p>
              </div>
            </div>

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-text-dim">
              <FileText className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm font-medium text-text-muted mb-1">
                No invoices yet
              </p>
              <p className="text-xs text-text-dim text-center max-w-xs">
                Invoices will appear here once your Stripe subscription is active and billing begins.
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
            <Info className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div className="text-sm text-text-muted">
              <span className="font-medium text-text-primary">
                Unit count is calculated automatically
              </span>{" "}
              from the total number of units across all buildings in your portfolio.
              Contact support if your unit count appears incorrect.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
