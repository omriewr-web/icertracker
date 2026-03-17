"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Circle,
  DoorOpen,
  Rocket,
  Shield,
  Users,
  Warehouse,
  ArrowRight,
  SkipForward,
  PartyPopper,
} from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import type { OnboardingStep } from "@/app/api/onboarding/status/route";

const stepIcons: Record<string, typeof Building2> = {
  "org-setup": Rocket,
  "add-building": Building2,
  "import-units": DoorOpen,
  "add-tenant": Warehouse,
  "import-violations": Shield,
  "invite-team": Users,
};

function StepCard({
  step,
  index,
  isCurrent,
}: {
  step: OnboardingStep;
  index: number;
  isCurrent: boolean;
}) {
  const Icon = stepIcons[step.id] || Circle;

  return (
    <div
      className={`relative rounded-lg border p-5 transition-all ${
        step.complete
          ? "border-[#4caf82]/30 bg-[#4caf82]/5"
          : isCurrent
          ? "border-[#c9a84c] bg-[#c9a84c]/5 shadow-[0_0_12px_rgba(201,168,76,0.15)]"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Step number + icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            step.complete
              ? "bg-[#4caf82]/20 text-[#4caf82]"
              : isCurrent
              ? "bg-[#c9a84c]/20 text-[#c9a84c]"
              : "bg-white/5 text-text-dim"
          }`}
        >
          {step.complete ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-dim font-medium">
              Step {index + 1}
            </span>
            {step.optional && (
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-dim">
                Optional
              </span>
            )}
            {step.complete && (
              <span className="rounded bg-[#4caf82]/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#4caf82]">
                Complete
              </span>
            )}
          </div>
          <h3
            className={`mt-1 text-sm font-semibold ${
              step.complete ? "text-text-muted line-through" : "text-text-primary"
            }`}
          >
            {step.title}
          </h3>
          <p className="mt-0.5 text-xs text-text-dim leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Action */}
        <div className="flex shrink-0 items-center gap-2">
          {!step.complete && step.optional && (
            <span className="text-[10px] text-text-dim flex items-center gap-1">
              <SkipForward className="h-3 w-3" />
              Skip
            </span>
          )}
          {!step.complete && (
            <Link
              href={step.actionHref}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#c9a84c] px-3 py-1.5 text-xs font-semibold text-[#0a1628] transition-colors hover:bg-[#c9a84c]/80"
            >
              {step.actionLabel}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          {step.complete && (
            <Link
              href={step.actionHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-card-hover"
            >
              View
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { data, isLoading } = useOnboarding();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <Rocket className="h-8 w-8 text-text-dim" />
        <p className="text-sm text-text-dim">Unable to load onboarding status.</p>
      </div>
    );
  }

  const { steps, completedCount, totalCount, requiredComplete, percentComplete } = data;

  // Find the first incomplete step to highlight
  const currentStepIndex = steps.findIndex((s) => !s.complete);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-bebas text-3xl tracking-wide text-text-primary">
          Get Started
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Complete these steps to set up your AtlasPM portfolio.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8 rounded-lg border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-text-primary">
            <span className="font-bebas text-2xl text-[#c9a84c]">
              {completedCount}
            </span>{" "}
            of {totalCount} steps complete
          </span>
          <span className="font-bebas text-2xl text-[#c9a84c]">
            {percentComplete}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-[#c9a84c] transition-all duration-500"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
        {requiredComplete && (
          <div className="mt-3 flex items-center gap-2 text-[#4caf82]">
            <PartyPopper className="h-4 w-4" />
            <span className="text-sm font-semibold">
              Setup complete! All required steps are done.
            </span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            isCurrent={i === currentStepIndex}
          />
        ))}
      </div>

      {/* Footer hint */}
      {!requiredComplete && (
        <p className="mt-6 text-center text-xs text-text-dim">
          Optional steps can be completed anytime. Focus on the required steps
          first.
        </p>
      )}
    </div>
  );
}
