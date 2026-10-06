"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, PartyPopper, ChevronDown, BookOpen, PlayCircle } from "lucide-react";
import type { OnboardingProgress } from "@/lib/onboarding";
import { tutoriel as tutorielDe, videoDe } from "@/lib/tutoriels";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

// ============================================
// Guided onboarding checklist, the same widget for every role. Unlike the
// passive list it replaces, it names the *next* action and gives it a
// button; finished steps collapse to a line.
//
// Collapsible, and the choice sticks: this sits at the top of the role home,
// so a user who has read it once should not have to scroll past it forever.
// The progress bar stays visible when collapsed.
//
// UNE LIGNE SUR TÉLÉPHONE, SUR LE DIRECT (`compact`). Dépliée, la liste
// remplissait tout le premier écran : le match en cours passait sous le pli,
// et un nouveau venu voyait des cases à cocher avant de voir du football. La
// ligne garde l'essentiel (où il en est, et le prochain geste, qui reste
// cliquable) ; le reste se déplie d'une touche. Sur ordinateur, la place ne
// manque pas : la liste reste entière.
// ============================================

const STORAGE_KEY = "koppafoot:onboarding-collapsed";

const T = textes(
  {
    titre: "Pour bien démarrer",
    fini: "Tout est en place. Bon match !",
    tutoriel: "Lire le tutoriel pas à pas",
    video: "Voir la vidéo",
    deplier: "Voir toutes les étapes",
  },
  {
    titre: "Getting started",
    fini: "You're all set. Enjoy the match!",
    tutoriel: "Read the step-by-step guide",
    video: "Watch the video",
    deplier: "See all steps",
  },
);

// localStorage is external state, so it is read through useSyncExternalStore
// rather than an effect: no hydration mismatch (the server snapshot is
// "expanded"), and every mounted checklist stays in sync.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // Private mode / storage disabled, stay expanded.
  }
}

function getServerCollapsed(): boolean {
  return false;
}

function storeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Nothing to persist, the toggle still works for this render.
  }
  listeners.forEach((l) => l());
}

export default function OnboardingChecklist({
  progress,
  title,
  onglets,
  compact = false,
}: {
  progress: OnboardingProgress;
  title?: string;
  /** Les autres guides du compte, quand il en a plusieurs : sous le titre. */
  onglets?: React.ReactNode;
  /** Sur téléphone, une seule ligne tant qu'on ne déplie pas (voir plus haut). */
  compact?: boolean;
}) {
  const t = useTextes(T);
  const { langue } = useLangue();
  const { steps, doneCount, total, current, complete, suggestion, tutoriel } = progress;
  const video = videoDe(tutorielDe(tutoriel), langue)?.video;
  const collapsed = useSyncExternalStore(subscribe, getCollapsed, getServerCollapsed);
  const toggle = () => storeCollapsed(!collapsed);
  // Déplié pour cette visite seulement : le Direct s'ouvre souvent, il
  // revient en ligne la fois suivante.
  const [deplie, setDeplie] = useState(false);
  const enLigne = compact && !deplie && !complete;
  const progression = `${total === 0 ? 0 : (doneCount / total) * 100}%`;

  return (
    <>
      {enLigne && (
        <div className="bg-gray-50 px-4 py-3 sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {title ?? t.titre} · <span className="text-emerald-600">{doneCount}/{total}</span>
              </p>
              {current && (
                <Link
                  href={current.href}
                  className="mt-0.5 flex items-center gap-1 text-sm font-black text-gray-900"
                >
                  <span className="truncate">{current.label}</span>
                  <ArrowRight size={14} className="shrink-0 text-emerald-600" />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDeplie(true)}
              aria-expanded={false}
              aria-label={t.deplier}
              className="-mr-2 flex size-11 shrink-0 items-center justify-center text-gray-400"
            >
              <ChevronDown size={18} />
            </button>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: progression }} />
          </div>
        </div>
      )}
      <div className={`bg-gray-50 p-5 ${enLigne ? "hidden sm:block" : deplie ? "apparition-deroule" : ""}`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">{title ?? t.titre}</p>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-black text-emerald-600">
              {doneCount}/{total}
            </span>
            <ChevronDown
              size={15}
              className={`text-gray-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
            />
          </span>
        </button>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${total === 0 ? 0 : (doneCount / total) * 100}%` }}
          />
        </div>

        {!collapsed && onglets}

        {collapsed ? null : complete ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-700">
            <PartyPopper size={16} />
            {t.fini}
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
                            className="mt-2.5 inline-flex items-center gap-1.5 bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600"
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

        {/* Sous la liste : la porte qui n'est pas une étape (choisir un rôle,
            pour un spectateur), et le tutoriel du profil, pour qui veut tout
            voir d'un coup plutôt qu'étape par étape. */}
        {!collapsed && (
          <div className="mt-4 space-y-2 border-t border-gray-200/70 pt-3">
            {suggestion && !complete && (
              <p className="text-xs font-semibold text-gray-500">
                {suggestion.texte}{" "}
                <Link href={suggestion.href} className="font-black text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-gray-900">
                  {suggestion.cta}
                </Link>
              </p>
            )}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={`/aide/tutoriels/${tutoriel}`}
                className="inline-flex items-center gap-1.5 text-xs font-black text-gray-600 transition-colors hover:text-gray-900"
              >
                <BookOpen size={13} />
                {t.tutoriel}
              </Link>
              {video && (
                <Link
                  href={`/aide/tutoriels/${tutoriel}#video`}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 transition-colors hover:text-gray-900"
                >
                  <PlayCircle size={13} />
                  {t.video}
                  {video.duree && <span className="tabular-nums font-bold text-gray-400">{video.duree}</span>}
                </Link>
              )}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
