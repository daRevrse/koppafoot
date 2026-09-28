"use client";

import ListeCandidatures, { type CandidatureAffichee } from "@/components/admin/ListeCandidatures";

// Les candidatures d'organisateur. Voir ListeCandidatures : la file, la carte
// et le refus motivé sont communs aux trois pages de candidatures.

interface Brute {
  id: string; uid: string; name: string; organizerName: string | null; email: string | null;
  phone: string | null; city: string | null; motivation: string; competitionName: string | null;
  status: CandidatureAffichee["statut"]; rejectionReason?: string | null; createdAt: string | null;
}

function lire(json: unknown): CandidatureAffichee[] {
  return ((json as { applications?: Brute[] }).applications ?? []).map((a) => ({
    id: a.id,
    uid: a.uid,
    statut: a.status,
    nom: a.name || "Candidat",
    titre: a.organizerName,
    email: a.email,
    telephone: a.phone,
    ville: a.city,
    le: a.createdAt,
    details: a.competitionName ? [{ label: "Première compétition", valeur: a.competitionName }] : [],
    motivation: a.motivation || null,
    motifRefus: a.rejectionReason ?? null,
  }));
}

export default function AdminOrganizersPage() {
  return (
    <ListeCandidatures
      titre="Organisateurs"
      sousTitre="Accepter ouvre l'espace organisateur du candidat, sous le nom qu'il a donné."
      url="/api/organizer-applications"
      lire={lire}
      urlDecision={(id) => `/api/organizer-applications/${id}`}
      accepter="Ouvrir son espace organisateur"
      exempleMotif="ex : Décris la compétition (équipes, lieu, dates) pour qu'on puisse l'accompagner."
    />
  );
}
