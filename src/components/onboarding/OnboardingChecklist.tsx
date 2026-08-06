"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, PartyPopper } from "lucide-react";
import type { OnboardingProgress } from "@/lib/onboarding";

// ============================================
// Guided onboarding checklist — the same widget for every role. Unlike the
// passive list it replaces, it names the *next* action and gives it a
// button; finished steps collapse to a line.
// ============================================

export default function OnboardingChecklist({
  progress,
  title = "Pour bien démarrer",
}: {
  progress: OnboardingProgress;
  title?: string;
}) {
  const { steps, doneCount, total, current, complete } = progress;

  return (
    <div className="rounded-2xl bg-gray-50 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400">{title}</p>
        <span className="text-xs font-black text-emerald-600">
          {doneCount}/{total}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${total === 0 ? 0 : (doneCount / total) * 100}%` }}
        />
      </div>

      {complete ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-700">
          <PartyPopper size={16} />
          Tout est en place. Bon match !
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {steps.map((step) => {
            const isCurrent = current?.key === step.key;
            return (
              <li key={step.key}>
                <div className="flex items-start gap-2.5">
                  {step.done ? (
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle
                      size={17}
                      className={`mt-0.5 shrink-0 ${isCurrent ? "text-emerald-400" : "text-gray-300"}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-bold ${
                        step.done
                          ? "text-gray-700"
                          : isCurrent
                            ? "text-gray-900"
                            : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <>
                        <p className="mt-0.5 text-xs font-semibold leading-relaxed text-gray-500">
                          {step.description}
                        </p>
                        <Link
                          href={step.href}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600"
                        >
                          {step.cta}
                          <ArrowRight size={13} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
