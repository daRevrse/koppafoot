"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Megaphone, Flag, Loader2, Send, Pin, Trash2, Check, ExternalLink,
  BadgeCheck, Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Admin, the official account's voice, and the moderation queue.
//
// Publishing as KoppaFoot is impossible from a browser by design (the rules
// require a post's author_id to match the caller), so both halves of this
// screen go through admin-SDK routes.
// ============================================

interface OfficialPost {
  id: string;
  content: string;
  type: string;
  link: string | null;
  pinned: boolean;
  likes: number;
  commentCount: number;
  createdAt: string | null;
}

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

/** Strips the `data:<type>;base64,` prefix, the route wants the payload. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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

  // Identity of the official account, and its own posts.
  const [identityName, setIdentityName] = useState("");
  const [identityAvatar, setIdentityAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);

  const [official, setOfficial] = useState<OfficialPost[]>([]);
  const [loadingOfficial, setLoadingOfficial] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const loadOfficial = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/admin/tribune", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setOfficial(data.posts ?? []);
      setIdentityName(data.identity?.name ?? "");
      setIdentityAvatar(data.identity?.avatarUrl ?? null);
    } catch {
      toast.error("Impossible de charger le compte officiel.");
    } finally {
      setLoadingOfficial(false);
    }
  }, [firebaseUser]);

  const saveIdentity = async () => {
    if (!firebaseUser || !identityName.trim()) {
      toast.error("Le nom est requis.");
      return;
    }
    setSavingIdentity(true);
    try {
      // The picture travels in the request rather than going straight to the
      // bucket: storage.rules denies browser writes on that path, because the
      // only thing that authorizes it is the superadmin check the route does.
      const avatar = avatarFile
        ? { data: await fileToBase64(avatarFile), contentType: avatarFile.type }
        : null;
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/admin/tribune", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: identityName.trim(), avatarUrl: identityAvatar, avatar }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Enregistrement impossible.");
        return;
      }
      setIdentityAvatar(data.identity?.avatarUrl ?? null);
      setAvatarFile(null);
      setAvatarPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      toast.success("Compte officiel mis à jour, tous ses posts suivent.");
    } catch (err) {
      console.error("Tribune identity save failed:", err);
      toast.error("Enregistrement impossible.");
    } finally {
      setSavingIdentity(false);
    }
  };

  const patchOfficial = async (id: string, body: Record<string, unknown>, done: string) => {
    if (!firebaseUser) return;
    setActing(id);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/admin/tribune", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue.");
        return;
      }
      toast.success(done);
      setEditingId(null);
      await loadOfficial();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setActing(null);
    }
  };

  const deleteOfficial = async (id: string) => {
    if (!firebaseUser) return;
    if (!confirm("Supprimer cette publication officielle ?")) return;
    setActing(id);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/admin/tribune", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Suppression impossible.");
        return;
      }
      toast.success("Publication supprimée.");
      setOfficial((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error("Suppression impossible.");
    } finally {
      setActing(null);
    }
  };

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
    loadOfficial();
  }, [loadReports, loadOfficial]);

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
      await loadOfficial();
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
      {/* Identity of the official account */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
          <BadgeCheck size={18} className="text-emerald-500" />
          Compte officiel
        </h2>
        <p className="mt-0.5 text-xs font-medium text-gray-400">
          Le nom et la photo sont résolus à l&apos;affichage : les modifier met à jour
          toutes ses publications, y compris les anciennes.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-gray-200">
            <img
              src={avatarPreview ?? (identityAvatar || "/icons/icon-192.png")}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <input
              type="text"
              value={identityName}
              onChange={(e) => setIdentityName(e.target.value)}
              placeholder="KoppaFoot"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  toast.error("Image trop lourde (2 Mo maximum).");
                  return;
                }
                setAvatarFile(f);
                setAvatarPreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return URL.createObjectURL(f);
                });
              }}
              className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700"
            />
          </div>
          <button
            type="button"
            onClick={saveIdentity}
            disabled={savingIdentity}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {savingIdentity ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Enregistrer
          </button>
        </div>
      </section>

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

      {/* The official account's own posts */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gray-900">
          <Megaphone size={18} className="text-emerald-500" />
          Publications officielles
          {official.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
              {official.length}
            </span>
          )}
        </h2>

        {loadingOfficial ? (
          <div className="flex justify-center py-8">
            <Loader2 size={22} className="animate-spin text-gray-300" />
          </div>
        ) : official.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-gray-400">
            Le compte officiel n&apos;a encore rien publié.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {official.map((p) => (
              <div key={p.id} className="rounded-xl border border-gray-100 p-3">
                {editingId === p.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => patchOfficial(p.id, { content: editContent }, "Publication modifiée.")}
                        disabled={acting === p.id || !editContent.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {acting === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-line text-sm text-gray-700">{p.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {p.pinned && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                          <Pin size={11} /> Épinglée
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-gray-400">
                        {p.likes} j&apos;aime · {p.commentCount} commentaire{p.commentCount > 1 ? "s" : ""}
                      </span>
                      {p.link && (
                        <a
                          href={p.link}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                        >
                          <ExternalLink size={11} /> {p.link}
                        </a>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditingId(p.id); setEditContent(p.content); }}
                          title="Modifier"
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => patchOfficial(p.id, { pinned: !p.pinned }, p.pinned ? "Désépinglée." : "Épinglée en haut de la Tribune.")}
                          disabled={acting === p.id}
                          title={p.pinned ? "Désépingler" : "Épingler"}
                          className={`rounded-lg p-1.5 transition-colors hover:bg-amber-50 disabled:opacity-50 ${
                            p.pinned ? "text-amber-600" : "text-gray-400 hover:text-amber-600"
                          }`}
                        >
                          <Pin size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteOfficial(p.id)}
                          disabled={acting === p.id}
                          title="Supprimer"
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
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
                {/* Snapshot taken when reported, the live post may have
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
