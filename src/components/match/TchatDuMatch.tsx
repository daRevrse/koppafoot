"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, Loader2, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import { TCHAT_MAX, tchatOuvert, type MessageDuTchat } from "@/lib/tchat";
import { envoyerMessage, signalerMessage, supprimerMessage } from "@/lib/tchat-client";

// ============================================
// L'onglet Tchat d'une fiche de match (voir lib/tchat).
//
// Pendant le direct, on y écrit avec un compte ; après, on le relit. Le texte
// s'affiche tel quel, jamais en HTML ni en lien cliquable : un tchat public
// est l'endroit rêvé pour poser un lien douteux.
// ============================================

const heure = (ms: number | null) =>
  ms == null ? "" : new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function TchatDuMatch({ mid, cid, statut, messages, peutModerer }: {
  mid: string;
  /** La compétition d'un match de compétition, `null` pour un amical. */
  cid: string | null;
  statut: string;
  messages: MessageDuTchat[];
  /** Le staff du match et l'administration suppriment tout message ; le serveur refait le contrôle. */
  peutModerer: boolean;
}) {
  const { user } = useAuth();
  const { open: ouvrirConnexion } = useAuthModal();
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const liste = useRef<HTMLDivElement>(null);
  const ouvert = tchatOuvert(statut);

  // Le dernier message en vue, sauf si on remonte lire : on ne vous arrache
  // pas à ce que vous lisiez.
  const enBas = useRef(true);
  useEffect(() => {
    const el = liste.current;
    if (el && enBas.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = texte.trim();
    if (!t || envoi) return;
    setEnvoi(true);
    try {
      await envoyerMessage(mid, cid, t);
      setTexte("");
      enBas.current = true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le message n'est pas parti");
    } finally {
      setEnvoi(false);
    }
  };

  const agir = async (id: string, action: "supprimer" | "signaler") => {
    if (action === "supprimer" && !window.confirm("Supprimer ce message ?")) return;
    setEnCours(id);
    try {
      if (action === "supprimer") await supprimerMessage(mid, cid, id);
      else {
        await signalerMessage(mid, cid, id);
        toast.success("Message signalé à l'équipe KoppaFoot");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="border border-gray-200/70 bg-white">
      {!ouvert && (
        <p className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500">
          Le match est terminé : le tchat se relit, il ne s&apos;écrit plus.
        </p>
      )}

      <div
        ref={liste}
        onScroll={(e) => {
          const el = e.currentTarget;
          enBas.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="max-h-[60vh] min-h-48 space-y-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            Personne n&apos;a encore écrit. Lance la discussion !
          </p>
        ) : (
          messages.map((m) => {
            const sien = user?.uid === m.auteurUid;
            return (
              <div key={m.id} className="group flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className={`font-bold ${sien ? "text-primary-700" : "text-gray-900"}`}>{m.auteurNom}</span>
                    <span className="ml-2 tabular-nums text-gray-400">{heure(m.creeLeMs)}</span>
                  </p>
                  {m.supprime ? (
                    <p className="text-sm italic text-gray-400">Message supprimé</p>
                  ) : (
                    <p className="break-words text-sm text-gray-800">{m.texte}</p>
                  )}
                </div>
                {!m.supprime && user && (
                  <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                    {(sien || peutModerer) && (
                      <button
                        type="button"
                        onClick={() => agir(m.id, "supprimer")}
                        disabled={enCours === m.id}
                        aria-label="Supprimer ce message"
                        className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {enCours === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    )}
                    {!sien && (
                      <button
                        type="button"
                        onClick={() => agir(m.id, "signaler")}
                        disabled={enCours === m.id}
                        aria-label="Signaler ce message"
                        className="p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                      >
                        <Flag size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {ouvert && (
        <div className="border-t border-gray-100 p-3">
          {user ? (
            <form onSubmit={envoyer} className="flex items-center gap-2">
              <input
                type="text"
                value={texte}
                onChange={(e) => setTexte(e.target.value.slice(0, TCHAT_MAX))}
                placeholder="Écris pendant le match…"
                maxLength={TCHAT_MAX}
                enterKeyHint="send"
                className="min-w-0 flex-1 border border-gray-200/70 px-3 py-2.5 text-base focus:border-primary-500 focus:outline-none sm:text-sm"
              />
              <button
                type="submit"
                disabled={envoi || !texte.trim()}
                aria-label="Envoyer"
                className="flex shrink-0 items-center justify-center bg-gray-900 p-2.5 text-white transition-colors hover:bg-black disabled:opacity-40"
              >
                {envoi ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => ouvrirConnexion("Connecte-toi pour écrire dans le tchat du match.")}
              className="w-full border border-gray-200/70 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Connecte-toi pour écrire
            </button>
          )}
          {user && texte.length > TCHAT_MAX - 40 && (
            <p className="mt-1 text-right text-[11px] tabular-nums text-gray-400">{texte.length}/{TCHAT_MAX}</p>
          )}
        </div>
      )}
    </div>
  );
}
