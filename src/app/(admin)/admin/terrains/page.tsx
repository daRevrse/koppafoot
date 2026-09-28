"use client";

import ListeCandidatures, { type CandidatureAffichee } from "@/components/admin/ListeCandidatures";
import { dateLue } from "@/lib/admin-tableau";
import { libelleFormat, libelleSurface } from "@/lib/terrains";

// Les terrains proposés : approuver publie la fiche et fait du candidat le
// propriétaire du terrain. Voir ListeCandidatures : la file, la carte et le
// refus motivé sont communs aux trois pages de candidatures.

interface Brute {
  id: string; uid: string; name: string; email: string | null; phone: string | null;
  venue_name: string; city: string | null; address: string | null; field_size: string | null;
  field_surface: string | null; motivation: string | null; status: CandidatureAffichee["statut"];
  rejection_reason?: string | null; created_at?: unknown;
}

function lire(json: unknown): CandidatureAffichee[] {
  return ((json as { applications?: Brute[] }).applications ?? []).map((a) => ({
    id: a.id,
    uid: a.uid,
    statut: a.status,
    nom: a.name || "Candidat",
    titre: a.venue_name,
    email: a.email,
    telephone: a.phone,
    ville: [a.address, a.city].filter(Boolean).join(", ") || null,
    le: dateLue(a.created_at)?.toISOString() ?? null,
    details: [
      { label: "Format", valeur: libelleFormat(a.field_size) },
      { label: "Surface", valeur: libelleSurface(a.field_surface) },
    ],
    motivation: a.motivation,
    motifRefus: a.rejection_reason ?? null,
  }));
}

export default function AdminVenueApplicationsPage() {
  return (
    <ListeCandidatures
      titre="Terrains proposés"
      sousTitre="Approuver publie la fiche du terrain et en confie la gestion au candidat."
      url="/api/venue-applications"
      lire={lire}
      urlDecision={(id) => `/api/venue-applications/${id}`}
      accepter="Publier le terrain"
      exempleMotif="ex : Précise ton lien avec le terrain : propriétaire, gérant, association…"
    />
  );
}
