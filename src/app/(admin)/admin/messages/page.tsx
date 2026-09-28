"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import {
  BOUTON_CONTOUR, BOUTON_PLEIN, Carte, Chargement, EnTete, Erreur, Filtres, Modale, Selecteur, Titre,
} from "@/components/admin/ui";
import { SEGMENTS, type Segment } from "@/lib/admin-segments";

// ============================================
// Écrire à la plateforme : un message, ou une relance.
//
// DEUX PAGES POUR UN MÊME GESTE. « Messages » et « Campagnes » envoyaient
// l'un comme l'autre une notification, un push et un e-mail ; elles vivent
// ensemble, en deux onglets.
//
// ON VOIT QUI RECEVRA, AVANT D'ENVOYER. Le message partait d'un clic, y
// compris à « Tous les utilisateurs » — un push et un e-mail sur tous les
// téléphones et dans toutes les boîtes, sans retour possible —, et l'écran
// découvrait après coup « envoyé à 0 utilisateur(s) » quand le segment ne
// trouvait personne. Le nombre de destinataires s'affiche pendant qu'on
// écrit, et l'envoi se confirme en le relisant.
// ============================================

type Cible = { genre: "segment"; segment: Segment } | { genre: "compte"; uid: string | null; email: string; nom: string | null };

interface Apercu { count: number; avecEmail: number; exemples: string[] }

interface Relance {
  type: "manager_no_team" | "player_no_team" | "manager_welcome" | "sans_espace";
  count: number;
  defaults: { title: string; body: string; link: string };
}

const RELANCES: Record<Relance["type"], { label: string; description: string }> = {
  sans_espace: {
    label: "Comptes sans espace",
    description: "Ni rôle choisi, ni casquette : ils ne voient que les scores. On les invite à choisir un rôle.",
  },
  manager_no_team: {
    label: "Managers sans équipe",
    description: "Managers qui ne dirigent encore aucun club.",
  },
  player_no_team: {
    label: "Joueurs sans équipe",
    description: "Joueurs qui ne sont dans aucun effectif et n'ont aucune candidature en cours.",
  },
  manager_welcome: {
    label: "Nouveaux managers",
    description: "Managers inscrits depuis moins de 48 heures : le message de bienvenue.",
  },
};

function Ecrire() {
  const params = useSearchParams();
  const agir = useAdminAction();
  const uidInitial = params.get("uid");
  const [cible, setCible] = useState<Cible>(() => uidInitial
    ? { genre: "compte", uid: uidInitial, email: "", nom: params.get("nom") }
    : { genre: "segment", segment: "tous" });
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [erreurApercu, setErreurApercu] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  // Le compte des destinataires, relu quand la cible change (un peu après la
  // frappe d'un e-mail, pas à chaque lettre).
  const cleCible = cible.genre === "segment" ? `s:${cible.segment}` : `c:${cible.uid ?? ""}:${cible.email.trim()}`;
  useEffect(() => {
    const corps = cible.genre === "segment"
      ? { apercu: true, segment: cible.segment }
      : cible.uid ? { apercu: true, uid: cible.uid } : { apercu: true, email: cible.email.trim() };
    if (cible.genre === "compte" && !cible.uid && !cible.email.includes("@")) return;
    const minuterie = setTimeout(() => {
      agir<Apercu>("/api/admin/send-message", "POST", corps)
        .then((a) => { setApercu(a); setErreurApercu(null); })
        .catch((e) => { setApercu(null); setErreurApercu(e instanceof Error ? e.message : "Destinataire introuvable"); });
    }, 350);
    return () => clearTimeout(minuterie);
    // cleCible résume la cible : la relire à chaque rendu relancerait l'aperçu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleCible, agir]);

  const envoyer = async () => {
    setEnvoi(true);
    try {
      const corps = cible.genre === "segment"
        ? { title: titre.trim(), body: message.trim(), segment: cible.segment }
        : { title: titre.trim(), body: message.trim(), ...(cible.uid ? { uid: cible.uid } : { email: cible.email.trim() }) };
      const r = await agir<{ count: number }>("/api/admin/send-message", "POST", corps);
      toast.success(`Message envoyé à ${r.count} compte${r.count > 1 ? "s" : ""}`);
      setTitre("");
      setMessage("");
      setConfirmer(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'envoi a échoué");
    } finally {
      setEnvoi(false);
    }
  };

  const pret = titre.trim() && message.trim() && apercu && apercu.count > 0;
  const nomCible = cible.genre === "segment"
    ? SEGMENTS.find((s) => s.valeur === cible.segment)?.label ?? ""
    : cible.nom ?? cible.email;

  return (
    <Carte className="space-y-4 p-4 sm:p-5">
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Destinataires</p>
        <div className="flex flex-wrap gap-2">
          <Selecteur
            label="Type de destinataire"
            valeur={cible.genre}
            onChange={(g) => setCible(g === "segment" ? { genre: "segment", segment: "tous" } : { genre: "compte", uid: null, email: "", nom: null })}
            options={[{ valeur: "segment", label: "Un groupe" }, { valeur: "compte", label: "Un compte" }]}
          />
          {cible.genre === "segment" ? (
            <Selecteur
              label="Groupe"
              valeur={cible.segment}
              onChange={(segment) => setCible({ genre: "segment", segment })}
              options={SEGMENTS}
            />
          ) : cible.uid ? (
            <span className="flex items-center gap-2 border border-gray-200/70 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900">
              {cible.nom ?? "Compte choisi"}
              <button onClick={() => setCible({ genre: "compte", uid: null, email: "", nom: null })} aria-label="Changer de compte" className="text-gray-400 hover:text-gray-900">
                <X size={14} />
              </button>
            </span>
          ) : (
            <input
              type="email"
              value={cible.email}
              onChange={(e) => setCible({ ...cible, email: e.target.value })}
              placeholder="E-mail du compte"
              className="min-w-0 flex-1 border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
            />
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {erreurApercu ? <span className="text-red-600">{erreurApercu}</span>
            : apercu ? (
              <>
                <strong className="font-black text-gray-900">{apercu.count} compte{apercu.count > 1 ? "s" : ""}</strong>
                {` recevront la notification et le push, ${apercu.avecEmail} l'e-mail.`}
                {apercu.exemples.length > 0 && ` ${apercu.exemples.slice(0, 3).join(", ")}${apercu.count > 3 ? "…" : ""}`}
              </>
            ) : "Choisis à qui écrire."}
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Titre</span>
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          maxLength={80}
          placeholder="ex : Nouvelle saison, nouvelles compétitions"
          className="w-full border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
          Message <span className="tabular-nums">{message.length}/500</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={5}
          className="w-full resize-none border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
        />
      </label>
      <button onClick={() => setConfirmer(true)} disabled={!pret} className={BOUTON_PLEIN}>
        <Send size={13} /> Relire et envoyer
      </button>

      {confirmer && apercu && (
        <Modale titre="Envoyer ce message ?" onFermer={() => !envoi && setConfirmer(false)}>
          <p className="text-sm text-gray-700">
            À <strong>{nomCible}</strong> : <strong>{apercu.count} compte{apercu.count > 1 ? "s" : ""}</strong>, par notification,
            push et e-mail ({apercu.avecEmail}). Un envoi ne se rattrape pas.
          </p>
          <div className="mt-4 border-l-2 border-gray-900 bg-gray-50 px-3 py-2">
            <p className="text-sm font-black text-gray-900">{titre}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{message}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={envoyer} disabled={envoi} className={BOUTON_PLEIN}>
              {envoi ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Envoyer à {apercu.count}
            </button>
            <button onClick={() => setConfirmer(false)} disabled={envoi} className={BOUTON_CONTOUR}>Revenir</button>
          </div>
        </Modale>
      )}
    </Carte>
  );
}

function Relances() {
  const { data, erreur, chargement, recharger } = useAdminApi<Relance[]>("/api/admin/campaigns");
  const agir = useAdminAction();
  const [ouverte, setOuverte] = useState<Relance | null>(null);
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const ouvrir = (r: Relance) => {
    setOuverte(r);
    setTitre(r.defaults.title);
    setMessage(r.defaults.body);
  };

  const envoyer = async () => {
    if (!ouverte) return;
    setEnvoi(true);
    try {
      const r = await agir<{ count: number }>("/api/admin/campaigns", "POST", {
        campaignType: ouverte.type, title: titre.trim(), body: message.trim(),
      });
      toast.success(`Relance envoyée à ${r.count} compte${r.count > 1 ? "s" : ""}`);
      setOuverte(null);
      recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'envoi a échoué");
    } finally {
      setEnvoi(false);
    }
  };

  if (chargement) return <Chargement />;
  if (erreur) return <Erreur message={erreur} onReessayer={recharger} />;

  return (
    <>
      <Carte className="divide-y divide-gray-200/70">
        {(data ?? []).map((r) => (
          <div key={r.type} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-10 shrink-0 font-display text-2xl font-black tabular-nums text-gray-900">{r.count}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-gray-900">{RELANCES[r.type].label}</p>
              <p className="text-xs text-gray-500">{RELANCES[r.type].description}</p>
            </div>
            <button onClick={() => ouvrir(r)} disabled={r.count === 0} className={BOUTON_CONTOUR}>Préparer</button>
          </div>
        ))}
      </Carte>
      {ouverte && (
        <Modale titre={RELANCES[ouverte.type].label} onFermer={() => !envoi && setOuverte(null)} largeur="max-w-lg">
          <p className="text-sm text-gray-600">
            <strong className="text-gray-900">{ouverte.count} compte{ouverte.count > 1 ? "s" : ""}</strong> : notification,
            push et un e-mail personnalisé. Un envoi ne se rattrape pas.
          </p>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Titre</span>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={80} className="w-full border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900" />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={4} className="w-full resize-none border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900" />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={envoyer} disabled={envoi || !titre.trim() || !message.trim()} className={BOUTON_PLEIN}>
              {envoi ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Envoyer à {ouverte.count}
            </button>
            <button onClick={() => setOuverte(null)} disabled={envoi} className={BOUTON_CONTOUR}>Revenir</button>
          </div>
        </Modale>
      )}
    </>
  );
}

function PageMessages() {
  const params = useSearchParams();
  const [onglet, setOnglet] = useState<"ecrire" | "relances">(params.get("onglet") === "relances" ? "relances" : "ecrire");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <EnTete titre="Messages" sousTitre="Une notification, un push et un e-mail, à un groupe ou à un compte." />
      <Filtres
        valeur={onglet}
        onChange={setOnglet}
        options={[{ valeur: "ecrire", label: "Écrire" }, { valeur: "relances", label: "Relances" }]}
      />
      {onglet === "ecrire" ? (
        <Ecrire />
      ) : (
        <section>
          <Titre>Relances prêtes à partir</Titre>
          <Relances />
        </section>
      )}
    </div>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<Chargement />}>
      <PageMessages />
    </Suspense>
  );
}
