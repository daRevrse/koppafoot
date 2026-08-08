"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Megaphone, Flag, Loader2, Send, Pin, Trash2, Check, ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Admin — the official account's voice, and the moderation queue.
//
// Publishing as KoppaFoot is impossible from a browser by design (the rules
// require a post's author_id to match the caller), so both halves of this
// screen go through admin-SDK routes.
// ============================================

interface Report {
  id: string;
  postId: string;
  postContent: string;
  postAuthorId: string;
  postAuthorName: string;
  reporterName: string;
  reason: string;
  status: string;
  createdAt: string | null;
}

export default function AdminTribunePage() {
  const { firebaseUser } = useAuth();

  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [pinned, setPinned] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/tribune/reports", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch {
      toast.error("Impossible de charger les signalements.");
    } finally {
      setLoadingReports(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const publish = async () => {
    if (!firebaseUser || !content.trim()) return;
    setPublishing(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/admin/tribune", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, link, pinned }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "La publication a échoué.");
        return;
      }
      toast.success(pinned ? "Publié et épinglé en haut de la Tribune." : "Publié dans la Tribune.");
      setContent("");
      setLink("");
      setPinned(false);
    } catch {
      toast.error("La publication a échoué.");
    } finally {
      setPublishing(false);
    }
  };

  const moderate = async (report: Report, action: "delete" | "dismiss") => {
    if (!firebaseUser) return;
    setActing(report.id);
    try {
      const token = await firebaseUser.getIdToken();
      if (action === "delete") {
        const res = await fetch("/api/admin/tribune", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: report.postId }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error ?? "Suppression impossible.");
          return;
        }
      }
      // Either way the report leaves the queue.
      await fetch("/api/tribune/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: report.id, action: "dismiss" }),
      });
      toast.success(action === "delete" ? "Publication supprimée." : "Signalement ignoré.");
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Composer */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
          <Megaphone size={18} className="text-emerald-600" />
          Publier au nom de KoppaFoot
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Le message paraît dans la Tribune signé du compte officiel, avec sa pastille verte.
        </p>

        <textarea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Votre annonce…"
          className="mt-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none"
        />

        <label className="mt-3 mb-1 block text-xs font-bold text-gray-600">
          Lien <span className="font-semibold text-gray-300">(optionnel)</span>
        </label>
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="/c/miabe-can-2026"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Pin size={14} className="text-gray-400" />
            Épingler en haut
            <span className="text-xs text-gray-400">(remplace l&apos;épinglé actuel)</span>
          </label>
          <button
            type="button"
            onClick={publish}
            disabled={publishing || !content.trim()}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            {publishing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Publier
          </button>
        </div>
      </section>

      {/* Reports */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
          <Flag size={18} className="text-red-500" />
          Signalements
          {reports.length > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
              {reports.length}
            </span>
          )}
        </h2>

        {loadingReports ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-gray-300" />
          </div>
        ) : reports.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Rien à modérer.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{r.postAuthorName}</p>
                    <p className="text-xs font-semibold text-gray-400">
                      signalé par {r.reporterName}
                    </p>
                  </div>
                  <a
                    href={`/feed?post=${r.postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600"
                  >
                    Voir <ExternalLink size={11} />
                  </a>
                </div>
                {/* Snapshot taken when reported — the live post may have
                    been edited since, or deleted outright. */}
                <p className="mt-2 border-l-2 border-gray-100 pl-3 text-xs italic leading-relaxed text-gray-600">
                  {r.postContent || "(sans texte)"}
                </p>
                {r.reason && (
                  <p className="mt-1.5 text-xs text-gray-500">Motif : {r.reason}</p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => moderate(r, "dismiss")}
                    disabled={acting === r.id}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Check size={13} /> Ignorer
                  </button>
                  <button
                    type="button"
                    onClick={() => moderate(r, "delete")}
                    disabled={acting === r.id}
                    className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    {acting === r.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    Supprimer le post
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
