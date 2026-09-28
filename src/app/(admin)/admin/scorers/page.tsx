"use client";

import ListeCandidatures, { type CandidatureAffichee } from "@/components/admin/ListeCandidatures";

// Les candidatures de scoreur. Voir ListeCandidatures : la file, la carte et
// le refus motivé sont communs aux trois pages de candidatures.

interface Brute {
  id: string; uid: string; name: string; email: string | null; phone: string | null;
  city: string | null; motivation: string; status: CandidatureAffichee["statut"];
  rejectionReason?: string | null; createdAt: string | null;
}

function lire(json: unknown): CandidatureAffichee[] {
  return ((json as { applications?: Brute[] }).applications ?? []).map((a) => ({
    id: a.id,
    uid: a.uid,
    statut: a.status,
    nom: a.name || "Candidat",
    titre: null,
    email: a.email,
    telephone: a.phone,
    ville: a.city,
    le: a.createdAt,
    details: [],
    motivation: a.motivation || null,
    motifRefus: a.rejectionReason ?? null,
  }));
}

export default function AdminScorersPage() {
  return (
    <ListeCandidatures
      titre="Scoreurs"
      sousTitre="Un scoreur tient le score en direct des amicaux qu'il ne joue pas : ce qu'il saisit alimente les statistiques et le classement."
      url="/api/scorer-applications"
      lire={lire}
      urlDecision={(id) => `/api/scorer-applications/${id}`}
      accepter="En faire un scoreur"
      exempleMotif="ex : On manque d'informations sur les matchs que tu suis. Précise tes quartiers et tes créneaux."
    />
  );
}
