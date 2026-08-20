"use client";

import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import type { Notification } from "@/types";

// ============================================
// Lire une notification en entier.
//
// La cloche tronque à deux lignes — il le faut, elle en montre plusieurs à la
// fois. Mais un message sans lien n'avait alors nulle part où être lu : le
// clic renvoyait sur /notifications, à charge de le retrouver dans la liste.
//
// Ce modal est cette destination manquante. Il sert les notifications qui
// sont un TEXTE à lire ; celles qui pointent vers un match, une équipe ou une
// candidature continuent d'y mener directement — ouvrir une fenêtre pour
// faire cliquer une deuxième fois serait un pas de plus, pas un de moins.
// ============================================

/** Une date lisible : « 20 août, 14:32 ». */
function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

export default function NotificationModal({
  notification, label, onClose,
}: {
  notification: Notification | null;
  /** Le libellé de sa catégorie, tel que l'écran appelant l'affiche déjà. */
  label?: string;
  onClose: () => void;
}) {
  if (!notification) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-titre"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Feuille montante sur téléphone, boîte centrée au-delà : le pouce
          atteint le bas de l'écran, pas son milieu. */}
      <div className="relative max-h-[85vh] w-full overflow-y-auto border border-gray-200/70 bg-white sm:max-w-lg">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200/70 px-5 py-4">
          <div className="min-w-0">
            {label && (
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                {label}
              </p>
            )}
            <h2
              id="notif-titre"
              className="mt-1 font-display text-lg font-black uppercase leading-tight tracking-tight text-gray-900"
            >
              {notification.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 p-1 text-gray-400 transition-colors hover:text-gray-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* `whitespace-pre-line` : un message écrit avec des retours à la
              ligne les garde. Un texte d'administration en a souvent. */}
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {notification.body}
          </p>

          <p className="mt-5 text-[11px] font-bold text-gray-400">
            {fullDate(notification.createdAt)}
          </p>
        </div>

        {notification.link && (
          <div className="border-t border-gray-200/70 px-5 py-4 pb-safe">
            <Link
              href={notification.link}
              onClick={onClose}
              className="inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
            >
              Y aller
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
