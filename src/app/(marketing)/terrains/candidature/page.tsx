"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Check, ArrowRight, Clock, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isVenueOwner } from "@/lib/hats";
import { FORMATS, SURFACES } from "@/lib/terrains";
import {
  FilAriane, Champ, Pastilles, Bouton, LienBouton, Fanion, EnCours, classeChamp,
} from "@/components/venue/venue-ui";

// ============================================
// Candidature « propriétaire de terrain ».
//
// Référencer un terrain, c'est publier une adresse et se présenter comme son
// gestionnaire. Rien n'empêche techniquement de le faire pour le terrain du
// voisin, d'où une relecture humaine, comme pour l'organisateur.
//
// LA CANDIDATURE DÉPOSÉE SE VOIT, désormais. Jusqu'ici, `sent` n'était qu'un
// état local : on rechargeait la page, le formulaire revenait vide comme si
// rien n'avait été envoyé, on renvoyait, et on récoltait une erreur brute
// « Ta candidature est déjà en cours d'examen » sous forme de bandeau rouge.
// Le seul dossier que la personne ait jamais déposé chez nous était
// invisible pour elle. La route savait pourtant déjà répondre `where uid ==
// moi` : personne ne l'appelait.
//
// La casquette qui en découle S'AJOUTE au compte : on reste joueur, manager
// ou arbitre en devenant propriétaire.
// ============================================

interface Candidature {
  id: string;
  venue_name: string;
  city: string | null;
  status: "pending" | "approved" | "rejected";
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-6 sm:px-10">
        <FilAriane
          items={[
            { href: "/", label: "Direct" },
            { href: "/terrains", label: "MyFields" },
            { label: "Candidature" },
          ]}
        />
        {children}
      </div>
    </section>
  );
}

/** Le bloc centré des états terminaux : envoyé, déjà propriétaire, refusé. */
function Verdict({
  Icon,
  titre,
  children,
  action,
  ton = "emerald",
}: {
  Icon: typeof MapPin;
  titre: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  ton?: "emerald" | "neutre";
}) {
  return (
    <div className="border border-gray-200/70 bg-white p-8 text-center sm:p-12">
      <Icon
        size={30}
        strokeWidth={1.5}
        className={`mx-auto ${ton === "emerald" ? "text-emerald-600" : "text-gray-300"}`}
      />
      <h1 className="mt-4 font-display text-xl font-black uppercase tracking-tight text-gray-900">
        {titre}
      </h1>
      <div className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">{children}</div>
      {action && <div className="mt-7 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export default function VenueApplicationPage() {
  const { user, firebaseUser, loading } = useAuth();

  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [fieldSize, setFieldSize] = useState("11v11");
  const [fieldSurface, setFieldSurface] = useState("synthetic");
  const [phone, setPhone] = useState("");
  const [motivation, setMotivation] = useState("");
  const [erreurs, setErreurs] = useState<{ nom?: string; ville?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  /** `null` = pas encore lu, `false` = lu, rien trouvé. */
  const [dossier, setDossier] = useState<Candidature | false | null>(null);
  /** Après un refus, on peut redéposer : ce drapeau rouvre le formulaire. */
  const [redepose, setRedepose] = useState(false);

  useEffect(() => {
    if (!user) return;
    setCity((c) => c || user.locationCity || "");
    setPhone((p) => p || user.phone || "");
  }, [user]);

  // Le dossier en cours, lu une fois. Sans cette lecture, la page ne savait
  // rien de ce que la personne avait déjà envoyé.
  const lireDossier = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/venue-applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setDossier(false); return; }
      const data = (await res.json()) as { applications?: Candidature[] };
      const liste = data.applications ?? [];
      // Le plus récent fait foi : un refus suivi d'un nouveau dépôt doit
      // montrer le dépôt, pas le refus.
      const enCours = liste.find((a) => a.status === "pending");
      setDossier(enCours ?? liste[liste.length - 1] ?? false);
    } catch {
      setDossier(false);
    }
  }, [firebaseUser]);

  useEffect(() => { void lireDossier(); }, [lireDossier]);

  const submit = async () => {
    if (!firebaseUser) return;

    const prochaines: typeof erreurs = {};
    if (venueName.trim().length < 2) prochaines.nom = "Indique le nom du terrain.";
    if (city.trim().length < 2) prochaines.ville = "Indique la ville du terrain.";
    setErreurs(prochaines);
    if (Object.keys(prochaines).length) return;

    setSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/venue-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueName, city, address, fieldSize, fieldSurface, phone, motivation }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'envoi.");
        // Une candidature déjà en cours : on relit plutôt que d'insister, la
        // page affichera l'état réel au lieu de répéter l'erreur.
        if (res.status === 409) { setRedepose(false); void lireDossier(); }
        return;
      }
      setRedepose(false);
      setDossier({ id: data.id, venue_name: venueName, city, status: "pending" });
    } catch {
      toast.error("Erreur réseau. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (firebaseUser && dossier === null)) {
    return <Cadre><EnCours /></Cadre>;
  }

  // Déjà propriétaire : la candidature n'a plus lieu d'être, on ajoute le
  // terrain suivant depuis son espace.
  if (isVenueOwner(user)) {
    return (
      <Cadre>
        <Verdict
          Icon={MapPin}
          titre="Tu gères déjà des terrains"
          action={<LienBouton href="/mes-terrains" Icon={ArrowRight}>Mes terrains</LienBouton>}
        >
          Le terrain suivant s&apos;ajoute depuis ton espace, sans repasser par ici.
        </Verdict>
      </Cadre>
    );
  }

  // Pas de compte : la connexion, avec le contexte de CETTE fonction et le
  // retour ici une fois le compte créé.
  if (!firebaseUser) {
    return (
      <Cadre>
        <div className="border border-gray-200/70 bg-white p-8 sm:p-12">
          <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-4xl">
            Référencer un terrain
          </h1>
          <p className="mt-5 text-base leading-relaxed text-gray-600">
            Il faut un compte : la fiche du terrain sera rattachée au vôtre, et
            c&apos;est par lui que les équipes vous demanderont un créneau.
          </p>
          <LienBouton
            href="/login?for=terrain&next=/terrains/candidature"
            Icon={ArrowRight}
            className="mt-8"
          >
            Créer mon compte
          </LienBouton>
        </div>
      </Cadre>
    );
  }

  // Un dossier en cours d'examen : on le MONTRE, avec ce qu'il contient et
  // ce qui va se passer. C'est le seul écran du parcours où la personne
  // attend quelqu'un d'autre.
  if (dossier && dossier.status === "pending") {
    return (
      <Cadre>
        <div className="border border-gray-200/70 bg-white p-8 sm:p-12">
          <Fanion ton="attente">En cours d&apos;examen</Fanion>
          <h1 className="mt-5 font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900 sm:text-3xl">
            {dossier.venue_name}
          </h1>
          {dossier.city && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-gray-500">
              <MapPin size={14} className="text-gray-400" />
              {dossier.city}
            </p>
          )}

          <div className="mt-8 border-t border-gray-200/70 pt-6">
            <p className="flex items-start gap-3 text-sm leading-relaxed text-gray-600">
              <Clock size={17} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                On relit la fiche. À l&apos;approbation, le terrain est publié
                dans l&apos;annuaire, votre espace s&apos;ouvre et vous êtes
                prévenu — notification, téléphone et email. Rien à resaisir.
              </span>
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <LienBouton href="/terrains/annuaire" variante="contour">
              Voir les terrains référencés
            </LienBouton>
          </div>
        </div>
      </Cadre>
    );
  }

  // Un refus : on le dit, et on rouvre la porte plutôt que de la fermer. Le
  // motif le plus fréquent est de ne pas avoir précisé son lien avec le lieu.
  if (dossier && dossier.status === "rejected" && !redepose) {
    return (
      <Cadre>
        <Verdict
          Icon={MapPin}
          ton="neutre"
          titre="Fiche non publiée"
          action={
            <Bouton Icon={RotateCcw} onClick={() => setRedepose(true)}>
              Redéposer ma demande
            </Bouton>
          }
        >
          La fiche de <strong className="font-black text-gray-900">{dossier.venue_name}</strong>{" "}
          n&apos;a pas été retenue. Si vous êtes bien le propriétaire ou
          l&apos;exploitant du lieu, redéposez-la en précisant votre lien avec
          lui — c&apos;est ce qui manque le plus souvent.
        </Verdict>
      </Cadre>
    );
  }

  if (dossier && dossier.status === "approved") {
    return (
      <Cadre>
        <Verdict
          Icon={Check}
          titre="Terrain publié"
          action={<LienBouton href="/mes-terrains" Icon={ArrowRight}>Ouvrir mes terrains</LienBouton>}
        >
          <strong className="font-black text-gray-900">{dossier.venue_name}</strong> est en ligne.
          Complétez sa fiche — photo, tarif, équipements — pour être choisi.
        </Verdict>
      </Cadre>
    );
  }

  return (
    <Cadre>
      <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-4xl">
        Référencer un terrain
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600">
        On relit chaque fiche avant publication : un terrain référencé engage
        celui qui le gère. Ça ne change rien à votre rôle sur le terrain, on
        reste joueur, manager ou arbitre en devenant propriétaire.
      </p>

      <div className="mt-8 space-y-5 border border-gray-200/70 bg-white p-6 sm:p-8">
        <Champ label="Nom du terrain" htmlFor="nom" erreur={erreurs.nom}>
          <input
            id="nom"
            type="text"
            value={venueName}
            onChange={(e) => { setVenueName(e.target.value); setErreurs((x) => ({ ...x, nom: undefined })); }}
            placeholder="ex: Terrain municipal"
            className={classeChamp}
          />
        </Champ>

        <div className="grid gap-5 sm:grid-cols-2">
          <Champ label="Ville" htmlFor="ville" erreur={erreurs.ville}>
            <input
              id="ville"
              type="text"
              value={city}
              onChange={(e) => { setCity(e.target.value); setErreurs((x) => ({ ...x, ville: undefined })); }}
              placeholder="Ta ville"
              className={classeChamp}
            />
          </Champ>
          <Champ label="Téléphone" htmlFor="tel">
            <input
              id="tel"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="ex: 90 00 00 00"
              className={classeChamp}
            />
          </Champ>
        </div>

        <Champ label="Adresse" htmlFor="adresse" optionnel>
          <input
            id="adresse"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rue, quartier"
            className={classeChamp}
          />
        </Champ>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Format</p>
          <Pastilles options={FORMATS} value={fieldSize} onChange={setFieldSize} nom="Format du terrain" />
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Surface</p>
          <Pastilles options={SURFACES} value={fieldSurface} onChange={setFieldSurface} nom="Surface du terrain" />
        </div>

        <Champ
          label="Votre lien avec ce terrain"
          htmlFor="lien"
          optionnel
          aide="C'est ce qui décide le plus souvent : dites qui vous êtes pour ce lieu."
        >
          <textarea
            id="lien"
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            rows={3}
            placeholder="Propriétaire, gérant, association qui l'exploite…"
            className={`${classeChamp} resize-none`}
          />
        </Champ>

        <Bouton Icon={MapPin} onClick={submit} occupe={submitting} className="w-full">
          Envoyer ma candidature
        </Bouton>

        <p className="text-center text-[11px] leading-relaxed text-gray-400">
          Photo, tarif et équipements se complètent après, dans votre espace.
        </p>
      </div>

      {redepose && (
        <p className="mt-4 text-center">
          <Link
            href="/terrains"
            className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700"
          >
            Retour à MyFields
          </Link>
        </p>
      )}
    </Cadre>
  );
}
