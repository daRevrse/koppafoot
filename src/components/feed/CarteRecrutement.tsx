"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Shield, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { createJoinRequest, getTeamById } from "@/lib/firestore";
import { LIBELLE_POSTE, POSTES_RECHERCHES, type PosteRecherche } from "@/lib/annonce-recrutement";
import type { Post, UserProfile } from "@/types";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

const T = textes(
  {
    rechercheJoueurs: "Recherche de joueurs",
    cherche: "Cherche",
    poste: (p: PosteRecherche) => LIBELLE_POSTE[p],
    termine: "Recrutement terminé",
    demander: "Demander à rejoindre",
    voirDemandes: "Voir les demandes",
    unMot: (nom: string) => `Un mot pour ${nom} (facultatif)`,
    envoyer: "Envoyer la demande",
    annuler: "Annuler",
    envoyee: "Demande envoyée",
    envoyeeA: (nom: string) => `Demande envoyée à ${nom}.`,
    dejaMembre: (equipe: string) => `Tu fais déjà partie de ${equipe}.`,
    plusOuverte: "Cette équipe ne recrute plus.",
    echec: "La demande n'est pas partie. Réessaie.",
    messageParDefaut: "Vu ton annonce dans la Tribune, je suis partant !",
  },
  {
    rechercheJoueurs: "Looking for players",
    cherche: "Looking for",
    poste: (p: PosteRecherche) => ({ gardien: "Goalkeeper", defenseur: "Defender", milieu: "Midfielder", attaquant: "Forward" })[p],
    termine: "Recruitment closed",
    demander: "Ask to join",
    voirDemandes: "See requests",
    unMot: (nom: string) => `A word for ${nom} (optional)`,
    envoyer: "Send request",
    annuler: "Cancel",
    envoyee: "Request sent",
    envoyeeA: (nom: string) => `Request sent to ${nom}.`,
    dejaMembre: (equipe: string) => `You're already in ${equipe}.`,
    plusOuverte: "This team is no longer recruiting.",
    echec: "Your request wasn't sent. Try again.",
    messageParDefaut: "Saw your post in the Tribune, I'm in!",
  },
);

/**
 * La carte d'une annonce de recrutement (lib/annonce-recrutement) : l'équipe,
 * les postes cherchés, et le bouton qui envoie la même demande que le
 * mercato, sans quitter la Tribune.
 *
 * Une annonce d'avant (sans `teamId`) garde sa carte d'origine, sans bouton :
 * on ne saurait pas à quelle équipe adresser la demande.
 */
export function CarteRecrutement({ post, currentUser }: { post: Post; currentUser: UserProfile | null }) {
  const t = useTextes(T);
  const meta = post.metadata;
  const [ouvert, setOuvert] = useState(false);
  const [mot, setMot] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);
  if (!meta?.teamName) return null;

  const postes = POSTES_RECHERCHES.filter((p) => meta.postes?.includes(p));
  const teamId = meta.teamId;
  const estAuteur = currentUser?.uid === post.authorId;
  const prenomAuteur = post.authorName.split(" ")[0] || post.authorName;

  const envoyer = async () => {
    if (!currentUser || !teamId) return;
    setEnvoi(true);
    try {
      // L'équipe d'aujourd'hui, pas celle de l'annonce : son manager a pu
      // changer, et le joueur y est peut-être déjà.
      const equipe = await getTeamById(teamId);
      if (!equipe || !equipe.isRecruiting) { toast.error(t.plusOuverte); return; }
      if (equipe.memberIds.includes(currentUser.uid)) { toast.error(t.dejaMembre(equipe.name)); return; }
      await createJoinRequest({
        playerId: currentUser.uid,
        playerName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        playerPhoto: currentUser.profilePictureUrl,
        playerCity: currentUser.locationCity,
        playerPosition: currentUser.position ?? "",
        playerLevel: currentUser.skillLevel ?? "",
        teamId,
        teamName: equipe.name,
        teamLogo: equipe.logoUrl ?? null,
        managerId: equipe.managerId,
        message: mot.trim() || t.messageParDefaut,
      });
      setEnvoyee(true);
      setOuvert(false);
      toast.success(t.envoyeeA(prenomAuteur));
    } catch (err) {
      console.error("Demande d'adhésion non envoyée :", err);
      toast.error(t.echec);
    } finally {
      setEnvoi(false);
    }
  };

  const logo = meta.teamLogo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={meta.teamLogo} alt="" className="h-10 w-10 shrink-0 object-cover" />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-blue-100">
      <Shield size={20} className="text-blue-600" />
    </div>
  );

  return (
    <div className={`mx-4 mb-2 p-3 ${meta.closed ? "bg-gray-50" : "bg-blue-50"}`}>
      <div className="flex items-center gap-3">
        {logo}
        <div className="min-w-0 flex-1">
          {teamId ? (
            <Link href={`/teams/${teamId}`} className="block truncate text-sm font-bold text-gray-900 hover:underline">
              {meta.teamName}
            </Link>
          ) : (
            <p className="truncate text-sm font-bold text-gray-900">{meta.teamName}</p>
          )}
          <p className={`text-xs ${meta.closed ? "text-gray-500" : "text-blue-600"}`}>
            {meta.closed
              ? t.termine
              : postes.length
                ? `${t.cherche} : ${postes.map((p) => t.poste(p)).join(" · ")}`
                : t.rechercheJoueurs}
            {meta.teamCity && !meta.closed ? ` · ${meta.teamCity}` : ""}
          </p>
        </div>
      </div>

      {teamId && !meta.closed && currentUser && (
        <div className="mt-3">
          {estAuteur ? (
            <Link
              href={`/teams/${teamId}`}
              className="block border border-blue-200 bg-white px-3 py-2 text-center text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100/50"
            >
              {t.voirDemandes}
            </Link>
          ) : envoyee ? (
            <p className="flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-emerald-700">
              <Check size={16} /> {t.envoyee}
            </p>
          ) : ouvert ? (
            <div className="space-y-2">
              <textarea
                value={mot}
                onChange={(e) => setMot(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder={t.unMot(prenomAuteur)}
                className="w-full resize-none border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={envoyer}
                  disabled={envoi}
                  className="flex flex-1 items-center justify-center gap-2 bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {envoi ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} {t.envoyer}
                </button>
                <button
                  onClick={() => setOuvert(false)}
                  className="border border-gray-200/70 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {t.annuler}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setOuvert(true)}
              className="flex w-full items-center justify-center gap-2 bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <UserPlus size={16} /> {t.demander}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
